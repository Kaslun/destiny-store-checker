import { z } from "zod";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminSupabase } from "@/lib/supabase-admin";
import { json, unauthenticated } from "@/lib/http";

export const runtime = "nodejs";

const SubBody = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthenticated();
  const parsed = SubBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const db = adminSupabase();
  await db.from("notification_prefs").upsert({
    user_id: session.user_id,
    web_push_subscription: parsed.data.subscription,
    web_push_enabled: true,
  });
  return new NextResponse(null, { status: 204 });
}
