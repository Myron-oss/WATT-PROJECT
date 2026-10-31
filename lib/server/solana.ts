/**
 * $WATT balance of a wallet, read straight from a Solana RPC (works for SPL Token and Token-2022 mints).
 * Cached for a few minutes so the leaderboard doesn't hammer the RPC.
 */
import { CONFIG } from "@/config";
import { getStore } from "./store";
import { isWallet } from "./session";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const CACHE_S = 1800; // holdings rarely change mid-week; 30 min keeps the rpc quiet

/** null when the token address isn't configured yet or the RPC can't be reached */
export async function wattBalance(wallet: string): Promise<number | null> {
  const mint = CONFIG.contractAddress;
  if (!isWallet(mint)) return null;
  const store = getStore();
  const key = `b:${wallet}`;
  const cached = await store.get<{ v: number }>(key);
  if (cached) return cached.v;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
      cache: "no-store",
    });
    const json = await res.json();
    if (json.error) return null;
    type Acc = { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } };
    const v = (json.result?.value as Acc[] | undefined)?.reduce(
      (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
      0,
    );
    if (v === undefined) return null;
    await store.set(key, { v }, { ex: CACHE_S });
    return v;
  } catch {
    return null;
  }
}

export async function isEligible(wallet: string): Promise<boolean | null> {
  const b = await wattBalance(wallet);
  return b === null ? null : b >= CONFIG.minWattForPrize;
}
