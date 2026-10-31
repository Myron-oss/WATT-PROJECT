import { CONFIG } from "@/config";
import { rankOf, top, weekOf, getPlayer } from "@/lib/server/game";
import { json, safe } from "@/lib/server/http";
import { isWallet, sessionWallet } from "@/lib/server/session";
import { isEligible } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  return safe(async () => {
    const week = weekOf();
    const rows = await top(10, week.id);
    const eligible = await Promise.all(rows.map((r) => isEligible(r.member)));
    const me = await sessionWallet();
    let mine = null;
    if (me) {
      const [rank, p] = await Promise.all([rankOf(me, week.id), getPlayer(me, week.id)]);
      mine = { wallet: me, rank, coins: p.coins };
    }
    return json({
      week: week.id,
      endsAt: week.end,
      prizes: CONFIG.prizesSol,
      minWatt: CONFIG.minWattForPrize,
      tokenSet: isWallet(CONFIG.contractAddress),
      rows: rows.map((r, i) => ({ rank: i + 1, wallet: r.member, coins: r.score, eligible: eligible[i] })),
      me: mine,
    });
  });
}
