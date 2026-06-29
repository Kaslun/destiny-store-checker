import { NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/session";
import { adminSupabase } from "@/lib/supabase-admin";
import { unauthenticated } from "@/lib/http";

export const runtime = "nodejs";

// Removes the user and everything that cascades from them: tokens, wishlist,
// notification prefs, and the notification log. (doc 00 §8 / doc 06 §3 privacy)
export async function POST() {
  const session = await getSession();
  if (!session) return unauthenticated();
  const db = adminSupabase();
  // ON DELETE CASCADE on user_id handles bungie_accounts, wishlist,
  // notification_prefs, notifications.
  await db.from("users").delete().eq("id", session.user_id);
  await destroySession();
  return new NextResponse(null, { status: 204 });
}
