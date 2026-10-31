import { NextResponse } from "next/server";
import { CONFIG } from "@/config";
import { top, weekOf } from "@/lib/server/game";
import { safe } from "@/lib/server/http";
import { isWallet } from "@/lib/server/session";
import { isEligible } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

/*
 * public and identical for everyone, so it's cached twice:
 * at vercel's cdn (10s, served stale up to 60s while refreshing) and in this server instance (5s).
 * a crowd watching the board costs the database one read every few seconds, not one per viewer.
 * (your own rank comes from /api/me.)
 */
let memo: { at: number; body: unknown } | null = null;
const MEMO_MS = 5_000;

export async function GET() {
  return safe(async () => {
    if (!memo || Date.now() - memo.at > MEMO_MS) {
      const week = weekOf();
      const rows = await top(10, week.id);
      const eligible = await Promise.all(rows.map((r) => isEligible(r.member)));
      memo = {
        at: Date.now(),
        body: {
          week: week.id,
          endsAt: week.end,
          prizes: CONFIG.prizesSol,
          minWatt: CONFIG.minWattForPrize,
          tokenSet: isWallet(CONFIG.contractAddress),
          rows: rows.map((r, i) => ({ rank: i + 1, wallet: r.member, coins: r.score, eligible: eligible[i] })),
        },
      };
    }
    return NextResponse.json(memo.body, {
      headers: { "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60" },
    });
  });
}
