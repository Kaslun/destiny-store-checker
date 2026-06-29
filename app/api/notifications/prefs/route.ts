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
    .from("notification_prefs")
    .select("email, email_enabled, web_push_enabled")
    .eq("user_id", session.user_id)
    .single();
  return json({
    emailEnabled: data?.email_enabled ?? false,
    email: data?.email ?? null,
    webPushEnabled: data?.web_push_enabled ?? false,
  });
}

const PutBody = z.object({
  emailEnabled: z.boolean().optional(),
  email: z.string().email().nullable().optional(),
  webPushEnabled: z.boolean().optional(),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return unauthenticated();
  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const db = adminSupabase();
  const patch: Record<string, unknown> = { user_id: session.user_id };
  if (parsed.data.emailEnabled !== undefined) patch.email_enabled = parsed.data.emailEnabled;
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;
  if (parsed.data.webPushEnabled !== undefined) patch.web_push_enabled = parsed.data.webPushEnabled;

  const { data, error } = await db
    .from("notification_prefs")
    .upsert(patch)
    .select("email, email_enabled, web_push_enabled")
    .single();
  if (error || !data) return json({ error: "write_failed" }, 500);
  return json({
    emailEnabled: data.email_enabled,
    email: data.email,
    webPushEnabled: data.web_push_enabled,
  });
}
