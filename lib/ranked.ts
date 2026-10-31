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

type State = { me: Me | null; loading: boolean; connecting: boolean; error: string | null };

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

const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/** connect phantom, sign the one-time message, start a session */
export async function connectPhantom() {
  const p = phantom();
  if (!p) {
    // no extension: on phones open this page inside phantom's browser, on desktop go get it
    const url = isMobile()
      ? `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`
      : "https://phantom.app/download";
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  set({ connecting: true, error: null });
  try {
    const { publicKey } = await p.connect();
    const wallet = publicKey.toString();
    const { message } = await api<{ message: string }>("/api/auth/nonce", { wallet });
    const { signature } = await p.signMessage(new TextEncoder().encode(message), "utf8");
    let bin = "";
    signature.forEach((b) => (bin += String.fromCharCode(b)));
    await api("/api/auth/verify", { wallet, signature: btoa(bin) });
    await refreshMe();
  } catch (e) {
    const code = (e as { code?: number | string }).code;
    set({ error: code === 4001 ? "cancelled in phantom" : "couldn't sign in, try again" });
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
