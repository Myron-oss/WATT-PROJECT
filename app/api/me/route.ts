import { CONFIG } from "@/config";
import { grantCoins, peekPlayer, rankOf, sweep, weekOf } from "@/lib/server/game";
import { withWallet } from "@/lib/server/http";
import { wattBalance } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  return withWallet(async (wallet) => {
    const active = await sweep(wallet);
    const week = weekOf();
    const watt = await wattBalance(wallet);
    const holder = watt === null ? null : watt >= CONFIG.minWattToPlay;
    // the week's coins go to holders only, on their first visit
    const p = (await peekPlayer(wallet, week.id)) ?? (holder ? await grantCoins(wallet, week.id) : null);
    const rank = p ? await rankOf(wallet, week.id) : null;
    return {
      wallet,
      ranked: !!p && holder !== false, // may play for coins right now
      holder,
      coins: p?.coins ?? 0,
      best: p?.best ?? 0,
      rounds: p?.rounds ?? 0,
      rank,
      watt,
      eligible: watt === null ? null : watt >= CONFIG.minWattForPrize,
      week: week.id,
      weekEndsAt: week.end,
      active,
    };
  });
}
