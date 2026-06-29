// Notification dispatch logic (doc 02 §8). Pure over its dependencies — no
// server-only imports — so it runs both in the GitHub Action and in tests.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailSender = (to: string, subject: string, html: string) => Promise<void>;
export type PushSender = (subscription: unknown, payload: string) => Promise<void>;

export type DispatchResult = {
  rotationDate: string;
  candidates: number;
  emailsSent: number;
  pushSent: number;
  skippedDuplicate: number;
  failed: number;
};

function utcRotationDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function dispatchNotifications(
  db: SupabaseClient,
  send: { email: EmailSender; push: PushSender },
  now = new Date()
): Promise<DispatchResult> {
  const rotationDate = utcRotationDate(now);
  const result: DispatchResult = {
    rotationDate, candidates: 0, emailsSent: 0, pushSent: 0, skippedDuplicate: 0, failed: 0,
  };

  // 1. Item hashes live in the current rotation.
  const { data: live } = await db.from("current_rotation").select("item_hash");
  const liveHashes = new Set((live ?? []).map((r) => Number(r.item_hash)));
  if (liveHashes.size === 0) return result;

  // 2. Wishlist rows with notify=true whose item is live, joined to prefs + item name.
  const { data: rows } = await db
    .from("wishlist")
    .select("user_id, item_hash, notify")
    .eq("notify", true)
    .in("item_hash", Array.from(liveHashes));

  // Group newly-live items per user.
  const perUser = new Map<string, number[]>();
  for (const r of rows ?? []) {
    if (!liveHashes.has(Number(r.item_hash))) continue;
    const arr = perUser.get(r.user_id) ?? [];
    arr.push(Number(r.item_hash));
    perUser.set(r.user_id, arr);
  }
  result.candidates = perUser.size;

  // Item names for the digest body.
  const allHashes = Array.from(new Set(Array.from(perUser.values()).flat()));
  const { data: items } = await db
    .from("catalog_items")
    .select("item_hash, name")
    .in("item_hash", allHashes);
  const nameOf = new Map((items ?? []).map((i) => [Number(i.item_hash), i.name as string]));

  for (const [userId, hashes] of perUser) {
    const { data: prefs } = await db
      .from("notification_prefs")
      .select("email, email_enabled, web_push_enabled, web_push_subscription")
      .eq("user_id", userId)
      .single();
    if (!prefs) continue;

    const names = hashes.map((h) => nameOf.get(h) ?? `Item ${h}`);
    const body = `These wishlist items are live in Eververse today: ${names.join(", ")}.`;
    const html = `<p>${body}</p><p>Open Everywherse to view them.</p>`;

    // Per-item dedupe per channel (one log row per user/item/date/channel).
    for (const channel of ["email", "web_push"] as const) {
      const enabled = channel === "email" ? prefs.email_enabled : prefs.web_push_enabled;
      if (!enabled) continue;
      if (channel === "email" && !prefs.email) continue;
      if (channel === "web_push" && !prefs.web_push_subscription) continue;

      // Which of this user's items have NOT yet been notified for this date+channel?
      const { data: already } = await db
        .from("notifications")
        .select("item_hash")
        .eq("user_id", userId)
        .eq("rotation_date", rotationDate)
        .eq("channel", channel)
        .in("item_hash", hashes);
      const done = new Set((already ?? []).map((r) => Number(r.item_hash)));
      const fresh = hashes.filter((h) => !done.has(h));
      if (fresh.length === 0) { result.skippedDuplicate += hashes.length; continue; }

      try {
        if (channel === "email") {
          await send.email(prefs.email as string, "Wishlist items live in Eververse", html);
          result.emailsSent += 1;
        } else {
          await send.push(prefs.web_push_subscription, JSON.stringify({ title: "Everywherse", body }));
          result.pushSent += 1;
        }
        // Write one dedupe row per item, only after a successful send.
        await db.from("notifications").insert(
          fresh.map((h) => ({
            user_id: userId, item_hash: h, rotation_date: rotationDate, channel, status: "sent",
          }))
        );
      } catch {
        result.failed += 1;
        // No dedupe row written -> retried on the next run.
      }
    }
  }
  return result;
}
