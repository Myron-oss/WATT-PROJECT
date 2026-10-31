import { signOut } from "@/lib/server/session";
import { json } from "@/lib/server/http";

export async function POST() {
  await signOut();
  return json({ ok: true });
}
