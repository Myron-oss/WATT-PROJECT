import { CONFIG } from "@/config";
import { detectBackend, getStore } from "@/lib/server/store";
import { isWallet } from "@/lib/server/session";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const LIMIT_MB = Number(process.env.REDIS_LIMIT_MB || 30);
const BYTES_PER_WALLET = 500; // a week's player key + leaderboard entries, generous

/** setup check: open /api/health on the deployed site (shows env var names, never values) */
export async function GET() {
  const b = detectBackend();
  const env =
    b.kind === "upstash" ? [b.url.name, b.token.name] : b.kind === "redis" ? [b.url.name] : [];
  const seen = Object.keys(process.env).filter((k) => /REDIS|KV_/.test(k));
  try {
    const s = getStore();
    await s.set("health:ping", Date.now(), { ex: 60 });
    const back = await s.get<number>("health:ping");
    if (!back) throw new Error("wrote a key but couldn't read it back");
    const u = await s.usage().catch(() => ({}) as { keys?: number; bytes?: number });
    const usedMb = u.bytes ? +(u.bytes / 1048576).toFixed(2) : undefined;
    return json({
      ok: true,
      store: s.kind,
      env,
      keys: u.keys,
      usedMb,
      limitMb: s.kind === "file" ? undefined : LIMIT_MB,
      roomForWallets:
        s.kind === "file" ? undefined : Math.floor(((LIMIT_MB - (usedMb ?? 1)) * 1048576) / BYTES_PER_WALLET),
      sessionSecret: process.env.SESSION_SECRET ? "env" : "auto (kept in the database)",
      rpc: process.env.SOLANA_RPC_URL ? "custom" : "public mainnet (rate-limited)",
      tokenSet: isWallet(CONFIG.contractAddress),
    });
  } catch (e) {
    return json(
      {
        ok: false,
        store: b.kind === "none" ? "missing" : b.kind,
        env,
        redisLikeEnvSeen: seen,
        error: e instanceof Error ? e.message : String(e),
        fix:
          b.kind === "none"
            ? "vercel → project → storage → connect a redis database (redis cloud or upstash) to this project, then redeploy"
            : "the database is configured but unreachable: check the url/password in vercel env vars, then redeploy",
      },
      503,
    );
  }
}
