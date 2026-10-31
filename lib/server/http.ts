import { NextResponse } from "next/server";
import { GameError } from "./game";
import { sessionWallet } from "./session";
import { StoreMissing, getStore } from "./store";

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** run a handler for the signed-in wallet; maps game errors to json */
export function errorResponse(e: unknown) {
  if (e instanceof GameError) return json({ error: e.code, ...e.extra }, e.status);
  // no database, or it can't be reached: the game falls back to practice mode
  const msg = e instanceof Error ? e.message : "";
  if (e instanceof StoreMissing || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection|Socket|WRONGPASS|NOAUTH/i.test(msg)) {
    console.error("[store]", msg);
    return json({ error: "offline" }, 503);
  }
  console.error(e);
  return json({ error: "server" }, 500);
}

/** catch-all for any route */
export async function safe(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}

export async function withWallet(fn: (wallet: string) => Promise<unknown>) {
  try {
    const wallet = await sessionWallet();
    if (!wallet) return json({ error: "signed_out" }, 401);
    return json(await fn(wallet));
  } catch (e) {
    return errorResponse(e);
  }
}

/** client ip as vercel reports it */
export const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();

/** true when this ip already did `name` within the last `seconds` (one cheap SET NX) */
export async function tooSoon(req: Request, name: string, seconds: number) {
  return !(await getStore().set(`rl:${name}:${ipOf(req)}`, 1, { nx: true, ex: seconds }));
}
