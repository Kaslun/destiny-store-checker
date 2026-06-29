import { z } from "zod";
import { getSession } from "@/lib/session";
import { adminSupabase } from "@/lib/supabase-admin";
import { json, unauthenticated } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthenticated();
  const db = adminSupabase();
  const { data } = await db
    .from("wishlist")
    .select("item_hash, notify, created_at")
    .eq("user_id", session.user_id)
    .order("created_at", { ascending: false });
  return json({
    items: (data ?? []).map((r) => ({
      itemHash: Number(r.item_hash),
      notify: r.notify,
      createdAt: r.created_at,
    })),
  });
}

const PostBody = z.object({ itemHash: z.number().int(), notify: z.boolean().optional() });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthenticated();
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const db = adminSupabase();
  const { data, error } = await db
    .from("wishlist")
    .upsert({
      user_id: session.user_id,
      item_hash: parsed.data.itemHash,
      notify: parsed.data.notify ?? true,
    })
    .select("item_hash, notify")
    .single();
  if (error || !data) return json({ error: "write_failed" }, 500);
  return json({ itemHash: Number(data.item_hash), notify: data.notify }, 201);
}
