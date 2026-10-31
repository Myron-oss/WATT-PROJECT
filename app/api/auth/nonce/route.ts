import { createNonce, isWallet } from "@/lib/server/session";
import { json, safe, tooSoon } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return safe(async () => {
    const { wallet } = await req.json().catch(() => ({}));
    if (!isWallet(wallet)) return json({ error: "bad_wallet" }, 400);
    if (await tooSoon(req, "nonce", 2)) return json({ error: "slow_down" }, 429);
    const domain = req.headers.get("host") ?? "watt";
    return json({ message: await createNonce(domain, wallet) });
  });
}
