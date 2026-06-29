import { NextResponse } from "next/server";
import { exchangeCode, getMembershipsForCurrentUser, primaryDestinyMembership } from "@/lib/bungie";
import { adminSupabase } from "@/lib/supabase-admin";
import { storeUserTokens } from "@/lib/tokens";
import { createSession, readOAuthState, clearOAuthState } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const expected = await readOAuthState();
  await clearOAuthState();
  if (!state || !expected || state !== expected) {
    return NextResponse.json({ error: "bad_state" }, { status: 403 });
  }
  if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

  // 1. Exchange the code for tokens (server-side, Basic auth).
  const tokens = await exchangeCode(code);

  // 2. Resolve the Destiny membership + display name.
  const memberships = await getMembershipsForCurrentUser(tokens.access_token);
  const destiny = primaryDestinyMembership(memberships);
  const displayName = destiny?.displayName ?? memberships.bungieNetUser.displayName;

  // 3. Upsert the user, keyed by bungie membership id.
  const db = adminSupabase();
  const { data: user, error } = await db
    .from("users")
    .upsert(
      {
        bungie_membership_id: tokens.membership_id,
        membership_type: destiny?.membershipType ?? null,
        display_name: displayName,
      },
      { onConflict: "bungie_membership_id" }
    )
    .select("id")
    .single();
  if (error || !user) {
    return NextResponse.json({ error: "user_upsert_failed" }, { status: 500 });
  }

  // 4. Encrypt + store tokens, mint the session (user_id only), redirect home.
  await storeUserTokens(user.id, tokens);
  await createSession(user.id);
  return NextResponse.redirect(new URL("/", process.env.APP_URL ?? req.url));
}
