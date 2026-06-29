import "server-only";
import { adminSupabase } from "./supabase-admin";
import { encryptToken, decryptToken } from "./crypto";
import { refreshTokens, type BungieTokens } from "./bungie";

export class NeedsReauthError extends Error {
  constructor() {
    super("needs_reauth");
    this.name = "NeedsReauthError";
  }
}

function expiryFrom(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

// Persist a fresh token set for a user (after login or refresh).
export async function storeUserTokens(userId: string, t: BungieTokens): Promise<void> {
  const db = adminSupabase();
  await db.from("bungie_accounts").upsert({
    user_id: userId,
    access_token_enc: encryptToken(t.access_token),
    refresh_token_enc: encryptToken(t.refresh_token),
    access_expires_at: expiryFrom(t.expires_in),
    refresh_expires_at: expiryFrom(t.refresh_expires_in),
    needs_reauth: false,
    updated_at: new Date().toISOString(),
  });
}

// Return a valid access token for a user, refreshing silently if needed.
export async function getValidAccessToken(userId: string): Promise<string> {
  const db = adminSupabase();
  const { data, error } = await db
    .from("bungie_accounts")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new NeedsReauthError();

  const now = Date.now();
  if (new Date(data.access_expires_at).getTime() - 60_000 > now) {
    return decryptToken(data.access_token_enc);
  }
  if (new Date(data.refresh_expires_at).getTime() <= now) {
    await db.from("bungie_accounts").update({ needs_reauth: true }).eq("user_id", userId);
    throw new NeedsReauthError();
  }
  // Refresh.
  try {
    const refreshed = await refreshTokens(decryptToken(data.refresh_token_enc));
    await storeUserTokens(userId, refreshed);
    return refreshed.access_token;
  } catch {
    await db.from("bungie_accounts").update({ needs_reauth: true }).eq("user_id", userId);
    throw new NeedsReauthError();
  }
}
