/**
 * Sign-in with Phantom: the wallet signs a one-time message (not a transaction),
 * the server checks the ed25519 signature and sets an HMAC-signed session cookie.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { cookies } from "next/headers";
import { getStore } from "./store";

const COOKIE = "watt_session";
const SESSION_DAYS = 7;
const NONCE_TTL = 300;

let cachedSecret: string | null = null;

/**
 * SESSION_SECRET if set; otherwise a random one generated once and kept in the store,
 * so a deployment only needs redis to work.
 */
async function secret() {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;
  if (cachedSecret) return cachedSecret;
  const store = getStore();
  await store.set("cfg:session_secret", randomBytes(48).toString("base64url"), { nx: true });
  cachedSecret = (await store.get<string>("cfg:session_secret"))!;
  return cachedSecret;
}

const sign = async (payload: string) => createHmac("sha256", await secret()).update(payload).digest("base64url");

export function isWallet(s: unknown): s is string {
  if (typeof s !== "string" || s.length < 32 || s.length > 44) return false;
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

export function signInMessage(domain: string, wallet: string, nonce: string, issued: string) {
  return [
    `${domain} wants you to sign in with your solana account:`,
    wallet,
    "",
    "sign in to the $watt weekly leaderboard. this is not a transaction and costs nothing.",
    "",
    `nonce: ${nonce}`,
    `issued at: ${issued}`,
  ].join("\n");
}

export async function createNonce(domain: string, wallet: string) {
  const nonce = randomBytes(16).toString("hex");
  const issued = new Date().toISOString();
  const message = signInMessage(domain, wallet, nonce, issued);
  await getStore().set(`nonce:${wallet}`, { message }, { ex: NONCE_TTL });
  return message;
}

/** checks the signature against the message we issued, then starts a session */
export async function verifySignIn(wallet: string, signatureB64: string) {
  const store = getStore();
  const pending = await store.get<{ message: string }>(`nonce:${wallet}`);
  if (!pending) return false;
  await store.del(`nonce:${wallet}`); // one shot
  let ok = false;
  try {
    const sig = Buffer.from(signatureB64, "base64");
    ok = nacl.sign.detached.verify(new TextEncoder().encode(pending.message), sig, bs58.decode(wallet));
  } catch {
    ok = false;
  }
  if (!ok) return false;
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = `${wallet}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
  return true;
}

/** the signed-in wallet, or null */
export async function sessionWallet(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [wallet, exp, mac] = raw.split(".");
  if (!wallet || !exp || !mac || Number(exp) < Date.now()) return null;
  const want = Buffer.from(await sign(`${wallet}.${exp}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return isWallet(wallet) ? wallet : null;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
