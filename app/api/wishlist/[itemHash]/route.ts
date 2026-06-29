import { z } from "zod";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminSupabase } from "@/lib/supabase-admin";
import { json, unauthenticated } from "@/lib/http";

export const runtime = "nodejs";

const PatchBody = z.object({ notify: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ itemHash: string }> }) {
  const session = await getSession();
  if (!session) return unauthenticated();
  const { itemHash } = await ctx.params;
  const hash = Number(itemHash);
  if (!Number.isInteger(hash)) return json({ error: "invalid_item" }, 400);

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const db = adminSupabase();
  const { data, error } = await db
    .from("wishlist")
    .update({ notify: parsed.data.notify })
    .eq("user_id", session.user_id)
    .eq("item_hash", hash)
    .select("item_hash, notify")
    .single();
  if (error || !data) return json({ error: "not_found" }, 404);
  return json({ itemHash: Number(data.item_hash), notify: data.notify });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ itemHash: string }> }) {
  const session = await getSession();
  if (!session) return unauthenticated();
  const { itemHash } = await ctx.params;
  const hash = Number(itemHash);
  if (!Number.isInteger(hash)) return json({ error: "invalid_item" }, 400);

  const db = adminSupabase();
  await db.from("wishlist").delete().eq("user_id", session.user_id).eq("item_hash", hash);
  return new NextResponse(null, { status: 204 });
}
