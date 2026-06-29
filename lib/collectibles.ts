import "server-only";
import { bungieGet } from "./bungie";
import { adminSupabase } from "./supabase-admin";

// DestinyCollectibleState bit flags (doc 02 §7).
const NOT_ACQUIRED = 1;
const OBSCURED = 1 << 4;     // 16
const INVISIBLE = 1 << 6;    // 64 — superset; keep for completeness

type ProfileCollectibles = {
  profileCollectibles?: { data?: { collectibles?: Record<string, { state: number }> } };
  characterCollectibles?: { data?: Record<string, { collectibles?: Record<string, { state: number }> }> };
};

export type Overlay = { owned: number[]; missing: number[]; obscured: number[] };

// Compute owned/missing/obscured item_hashes for a membership.
export async function computeOverlay(
  accessToken: string,
  membershipType: number,
  destinyMembershipId: string
): Promise<Overlay> {
  const profile = await bungieGet<ProfileCollectibles>(
    `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=800`,
    accessToken
  );

  // Merge profile-level and any character-level collectible states.
  const states: Record<string, number> = {};
  const pc = profile.profileCollectibles?.data?.collectibles ?? {};
  for (const [hash, v] of Object.entries(pc)) states[hash] = v.state;
  const cc = profile.characterCollectibles?.data ?? {};
  for (const char of Object.values(cc)) {
    for (const [hash, v] of Object.entries(char.collectibles ?? {})) {
      // A collectible owned on any character counts as owned.
      states[hash] = (states[hash] ?? v.state) & v.state;
    }
  }

  // Map collectible_hash -> item_hash for Eververse items that have a collectible.
  const db = adminSupabase();
  const { data: items } = await db
    .from("catalog_items")
    .select("item_hash, collectible_hash")
    .not("collectible_hash", "is", null)
    .eq("is_eververse", true);

  const owned: number[] = [];
  const missing: number[] = [];
  const obscured: number[] = [];
  for (const it of items ?? []) {
    const state = states[String(it.collectible_hash)];
    if (state === undefined) continue; // unknown -> neither
    if (state & OBSCURED || state & INVISIBLE) obscured.push(Number(it.item_hash));
    if (state & NOT_ACQUIRED) missing.push(Number(it.item_hash));
    else owned.push(Number(it.item_hash));
  }
  return { owned, missing, obscured };
}
