import { cashOut } from "@/lib/server/game";
import { withWallet } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  return withWallet((wallet) => cashOut(wallet, String(id)));
}
