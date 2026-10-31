import { createNonce, isWallet } from "@/lib/server/session";
import { json, safe } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return safe(async () => {
    const { wallet } = await req.json().catch(() => ({}));
    if (!isWallet(wallet)) return json({ error: "bad_wallet" }, 400);
    const domain = req.headers.get("host") ?? "watt";
    return json({ message: await createNonce(domain, wallet) });
  });
}
