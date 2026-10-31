import { startRound } from "@/lib/server/game";
import { withWallet } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { bet } = await req.json().catch(() => ({}));
  return withWallet((wallet) => startRound(wallet, Number(bet)));
}
