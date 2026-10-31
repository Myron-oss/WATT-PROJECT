"use client";

/**
 * Browser side of the ranked game: Phantom connect + sign-in, the session, and round calls.
 * One tiny shared store so the nav, the hero and the leaderboard all see the same wallet.
 */
import { useSyncExternalStore } from "react";

export type Me = {
  wallet: string;
  coins: number;
  best: number;
  rounds: number;
  rank: number | null;
  watt: number | null;
  eligible: boolean | null;
  week: string;
  weekEndsAt: number;
  active: string | null;
};

export type RoundResult = {
  id: string;
  state: "won" | "crashed";
  m: number;
  crash: number;
  bet: number;
  payout: number;
  coins: number;
  seed: string;
};

export type AuthError = { text: string; link?: { href: string; label: string } };
type State = { me: Me | null; loading: boolean; connecting: boolean; error: AuthError | null };

let state: State = { me: null, loading: true, connecting: false, error: null };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

export function useRanked() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}

/** patch the local copy (e.g. coins after a round) without a round-trip */
export const clearAuthError = () => set({ error: null });

export const patchMe = (p: Partial<Me>) => state.me && set({ me: { ...state.me, ...p } });

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });
  const json = await res.json().catch(() => ({ error: "server" }));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "server"), { code: json.error ?? "server", data: json });
  return json as T;
}

export async function refreshMe() {
  try {
    const me = await api<Me>("/api/me");
    set({ me, loading: false });
    return me;
  } catch {
    set({ me: null, loading: false });
    return null;
  }
}

/* ---------- phantom ---------- */

type Phantom = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(msg: Uint8Array, enc?: "utf8"): Promise<{ signature: Uint8Array }>;
};

function phantom(): Phantom | null {
  const w = window as unknown as { phantom?: { solana?: Phantom }; solana?: Phantom };
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

/** phantom injects itself shortly after load; give it a moment before deciding it isn't there */
function waitForPhantom(ms = 1500): Promise<Phantom | null> {
  const now = phantom();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const started = Date.now();
    const done = () => {
      clearInterval(t);
      window.removeEventListener("phantom#initialized", done);
      resolve(phantom());
    };
    const t = setInterval(() => {
      if (phantom() || Date.now() - started > ms) done();
    }, 100);
    window.addEventListener("phantom#initialized", done, { once: true });
  });
}

const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

const SERVER_ERRORS: Record<string, string> = {
  bad_wallet: "phantom returned an address the server didn't accept",
  bad_signature: "the signature didn't check out, try again",
  bad_request: "sign-in request was malformed, reload and retry",
  server: "the sign-in server isn't set up (SESSION_SECRET / redis), see README",
};

/** connect phantom, sign the one-time message, start a session */
export async function connectPhantom() {
  set({ connecting: true, error: null });
  const p = await waitForPhantom();
  if (!p) {
    set({ connecting: false });
    if (isMobile()) {
      // phones: reopen this page inside phantom's own browser
      const url = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`;
      set({ error: { text: "phantom isn't in this browser.", link: { href: url, label: "open in phantom" } } });
      return;
    }
    set({
      error: {
        text: "phantom isn't installed in this browser. use chrome, brave or firefox with the phantom extension.",
        link: { href: "https://phantom.app/download", label: "get phantom" },
      },
    });
    return;
  }
  let step = "connect";
  try {
    const { publicKey } = await p.connect();
    const wallet = publicKey.toString();
    step = "nonce";
    const { message } = await api<{ message: string }>("/api/auth/nonce", { wallet });
    step = "sign";
    const { signature } = await p.signMessage(new TextEncoder().encode(message), "utf8");
    let bin = "";
    signature.forEach((b) => (bin += String.fromCharCode(b)));
    step = "verify";
    await api("/api/auth/verify", { wallet, signature: btoa(bin) });
    if (!(await refreshMe())) throw Object.assign(new Error("no session"), { code: "no_session" });
  } catch (e) {
    const code = (e as { code?: number | string }).code;
    const text =
      code === 4001
        ? step === "connect"
          ? "connection cancelled in phantom"
          : "signature cancelled in phantom"
        : code === -32603 || code === 4100
          ? "phantom is locked or not ready, open it and try again"
          : code === "no_session"
            ? "signed in, but the browser didn't keep the login cookie (blocked cookies?)"
            : typeof code === "string" && SERVER_ERRORS[code]
              ? SERVER_ERRORS[code]
              : step === "nonce" || step === "verify"
                ? "can't reach the sign-in server, try again"
                : "phantom didn't respond, try again";
    console.warn("[watt] phantom sign-in failed at", step, e);
    set({ error: { text } });
  } finally {
    set({ connecting: false });
  }
}

export async function signOutRanked() {
  await api("/api/auth/logout", {}).catch(() => {});
  await phantom()?.disconnect().catch(() => {});
  set({ me: null });
}

/* ---------- rounds ---------- */

export const startRanked = (bet: number) => api<{ id: string; bet: number; coins: number; commit: string }>("/api/round/start", { bet });
export const cashoutRanked = (id: string) => api<RoundResult>("/api/round/cashout", { id });

/** resolves when the server says the round is over (crash, or our own cash-out) */
export async function waitRanked(id: string, signal: AbortSignal): Promise<RoundResult> {
  for (;;) {
    const r = await api<RoundResult | { state: "running" }>(`/api/round/wait?id=${encodeURIComponent(id)}`, undefined, signal);
    if (r.state !== "running") return r as RoundResult;
  }
}

export const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
