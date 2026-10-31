import { CONFIG } from "@/config";
import { getStore } from "@/lib/server/store";
import { isWallet } from "@/lib/server/session";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** quick setup check: open /api/health on the deployed site */
export async function GET() {
  const hasRedisEnv = !!(
    (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)
  );
  let store: "redis" | "local file" | "missing" | "error" = "missing";
  let storeError: string | undefined;
  try {
    const s = getStore();
    await s.set("health:ping", Date.now(), { ex: 60 });
    store = hasRedisEnv ? "redis" : "local file";
  } catch (e) {
    store = hasRedisEnv ? "error" : "missing";
    storeError = e instanceof Error ? e.message : String(e);
  }
  const ok = store === "redis" || store === "local file";
  return json(
    {
      ok,
      store,
      storeError,
      sessionSecret: process.env.SESSION_SECRET ? "env" : "auto (kept in redis)",
      rpc: process.env.SOLANA_RPC_URL ? "custom" : "public mainnet (rate-limited)",
      tokenSet: isWallet(CONFIG.contractAddress),
      fix: ok ? undefined : "vercel → project → storage → create database → upstash for redis → connect to this project, then redeploy",
    },
    ok ? 200 : 503,
  );
}
