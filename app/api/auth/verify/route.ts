import { isWallet, verifySignIn } from "@/lib/server/session";
import { json, safe } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return safe(async () => {
    const { wallet, signature } = await req.json().catch(() => ({}));
    if (!isWallet(wallet) || typeof signature !== "string") return json({ error: "bad_request" }, 400);
    const ok = await verifySignIn(wallet, signature);
    return ok ? json({ ok: true }) : json({ error: "bad_signature" }, 401);
  });
}
