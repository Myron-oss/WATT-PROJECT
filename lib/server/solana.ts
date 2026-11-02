/**
 * $WATT balance of a wallet, read straight from a Solana RPC (works for SPL Token and Token-2022 mints).
 *
 * Built to live on the free public RPC: holders are cached for 30 minutes, a zero balance only for
 * a minute (someone who just bought shouldn't wait), a "too many requests" gets two short retries,
 * and if the RPC still fails the last known balance (up to a day old) is used.
 * Set SOLANA_RPC_URL (e.g. a free Helius key) to lift the limits entirely.
 */
import { CONFIG } from "@/config";
import { getStore } from "./store";
import { isWallet } from "./session";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const FRESH_MS = 30 * 60_000; // holdings rarely change mid-week
const ZERO_FRESH_MS = 60_000;
const KEEP_S = 86_400; // stale fallback window

type Cached = { v: number; at: number };
type Acc = { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } };

async function rpcBalance(wallet: string, mint: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`rpc ${res.status}`);
      const json = await res.json();
      if (json.error) {
        // the token doesn't exist on-chain (yet): nobody holds it
        if (/could not find mint/i.test(String(json.error.message))) return 0;
        return null; // a real answer: bad params etc., retrying won't help
      }
      const value = json.result?.value as Acc[] | undefined;
      if (!value) return null;
      return value.reduce((sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    } catch {
      if (attempt < 2) await new Promise((ok) => setTimeout(ok, 400 * 2 ** attempt + Math.random() * 300));
    }
  }
  return null;
}

/** null when the token address isn't configured yet, or the rpc failed and nothing was cached */
export async function wattBalance(wallet: string): Promise<number | null> {
  const mint = CONFIG.contractAddress;
  if (!isWallet(mint)) return null;
  const store = getStore();
  const key = `b:${wallet}`;
  const cached = await store.get<Cached>(key);
  if (cached && Date.now() - cached.at < (cached.v > 0 ? FRESH_MS : ZERO_FRESH_MS)) return cached.v;
  const v = await rpcBalance(wallet, mint);
  if (v === null) return cached?.v ?? null; // rpc busy: last known balance beats "unknown"
  await store.set(key, { v, at: Date.now() } satisfies Cached, { ex: KEEP_S });
  return v;
}

/** true/false, or null when the balance can't be determined right now */
export async function isHolder(wallet: string): Promise<boolean | null> {
  const b = await wattBalance(wallet);
  return b === null ? null : b >= CONFIG.minWattToPlay;
}

export async function isEligible(wallet: string): Promise<boolean | null> {
  const b = await wattBalance(wallet);
  return b === null ? null : b >= CONFIG.minWattForPrize;
}
