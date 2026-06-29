import { adminSupabase } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";
import { json, unauthenticated } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthenticated();
  const db = adminSupabase();
  const { data } = await db.from("users").select("id, display_name").eq("id", session.user_id).single();
  if (!data) return unauthenticated();
  return json({ userId: data.id, displayName: data.display_name });
}
