import { NextResponse } from "next/server";
import { GameError } from "./game";
import { sessionWallet } from "./session";

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** run a handler for the signed-in wallet; maps game errors to json */
export async function withWallet(fn: (wallet: string) => Promise<unknown>) {
  const wallet = await sessionWallet();
  if (!wallet) return json({ error: "signed_out" }, 401);
  try {
    return json(await fn(wallet));
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.code, ...e.extra }, e.status);
    console.error(e);
    return json({ error: "server" }, 500);
  }
}
