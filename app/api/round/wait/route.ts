import { waitRound } from "@/lib/server/game";
import { withWallet } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // long-poll: answers the moment the round crashes

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return withWallet((wallet) => waitRound(wallet, id));
}
