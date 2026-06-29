import { getSession } from "@/lib/session";
import { getValidAccessToken, NeedsReauthError } from "@/lib/tokens";
import { bungieGet } from "@/lib/bungie";
import { adminSupabase } from "@/lib/supabase-admin";
import { json, unauthenticated, needsReauth } from "@/lib/http";

export const runtime = "nodejs";

type ProfileCurrencies = {
  profileCurrencies?: { data?: { items?: Array<{ itemHash: number; quantity: number }> } };
};

export async function GET() {
  const session = await getSession();
  if (!session) return unauthenticated();
  try {
    const token = await getValidAccessToken(session.user_id);
    const db = adminSupabase();
    const [{ data: user }, { data: cfg }] = await Promise.all([
      db.from("users").select("membership_type, bungie_membership_id").eq("id", session.user_id).single(),
      db.from("config").select("value").eq("key", "bright_dust_hash").single(),
    ]);
    if (!user) return unauthenticated();
    const brightDustHash = Number((cfg?.value as { hash?: number } | null)?.hash ?? 0);

    const profile = await bungieGet<ProfileCurrencies>(
      `/Destiny2/${user.membership_type}/Profile/${user.bungie_membership_id}/?components=103`,
      token
    );
    const items = profile.profileCurrencies?.data?.items ?? [];
    const brightDust = items.find((i) => i.itemHash === brightDustHash)?.quantity ?? 0;
    return json({ brightDust });
  } catch (e) {
    if (e instanceof NeedsReauthError) return needsReauth();
    throw e;
  }
}
