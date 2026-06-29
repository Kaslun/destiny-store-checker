import { getSession } from "@/lib/session";
import { getValidAccessToken, NeedsReauthError } from "@/lib/tokens";
import { adminSupabase } from "@/lib/supabase-admin";
import { computeOverlay } from "@/lib/collectibles";
import { json, unauthenticated, needsReauth } from "@/lib/http";

export const runtime = "nodejs";

// Cache the computed overlay briefly per user (doc 02 §7: ~5–10 min).
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 7 * 60_000;

export async function GET() {
  const session = await getSession();
  if (!session) return unauthenticated();

  const hit = cache.get(session.user_id);
  if (hit && Date.now() - hit.at < TTL) return json(hit.data);

  try {
    const token = await getValidAccessToken(session.user_id);
    const db = adminSupabase();
    const { data: user } = await db
      .from("users")
      .select("membership_type, bungie_membership_id")
      .eq("id", session.user_id)
      .single();
    if (!user) return unauthenticated();
    const overlay = await computeOverlay(
      token,
      user.membership_type as number,
      user.bungie_membership_id as string
    );
    cache.set(session.user_id, { at: Date.now(), data: overlay });
    return json(overlay);
  } catch (e) {
    if (e instanceof NeedsReauthError) return needsReauth();
    throw e;
  }
}
