import { CONFIG } from "@/config";
import { getPlayer, rankOf, sweep, weekOf } from "@/lib/server/game";
import { withWallet } from "@/lib/server/http";
import { wattBalance } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  return withWallet(async (wallet) => {
    const active = await sweep(wallet);
    const week = weekOf();
    const p = await getPlayer(wallet, week.id); // creates the week's bankroll on first visit
    const [rank, watt] = await Promise.all([rankOf(wallet, week.id), wattBalance(wallet)]);
    return {
      wallet,
      coins: p.coins,
      best: p.best,
      rounds: p.rounds,
      rank,
      watt,
      eligible: watt === null ? null : watt >= CONFIG.minWattForPrize,
      week: week.id,
      weekEndsAt: week.end,
      active,
    };
  });
}
