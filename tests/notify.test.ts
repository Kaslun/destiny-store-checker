import { describe, it, expect } from "vitest";
import { dispatchNotifications } from "../lib/notify";

// Minimal in-memory fake of the subset of the Supabase query builder we use.
function fakeDb(seed: {
  rotation: number[];
  wishlist: { user_id: string; item_hash: number; notify: boolean }[];
  prefs: Record<string, { email: string | null; email_enabled: boolean; web_push_enabled: boolean; web_push_subscription: unknown }>;
  items: Record<number, string>;
  notifications: { user_id: string; item_hash: number; rotation_date: string; channel: string }[];
}) {
  const notifications = [...seed.notifications];
  function builder(table: string) {
    let rows: any[] = [];
    if (table === "current_rotation") rows = seed.rotation.map((h) => ({ item_hash: h }));
    if (table === "wishlist") rows = seed.wishlist;
    if (table === "catalog_items") rows = Object.entries(seed.items).map(([h, name]) => ({ item_hash: Number(h), name }));
    if (table === "notifications") rows = notifications;
    const filters: [string, any][] = [];
    const inFilters: [string, any[]][] = [];
    const q: any = {
      select() { return q; },
      eq(col: string, val: any) { filters.push([col, val]); return q; },
      in(col: string, vals: any[]) { inFilters.push([col, vals]); return q; },
      single() {
        if (table === "notification_prefs") {
          const uid = filters.find((f) => f[0] === "user_id")?.[1];
          return Promise.resolve({ data: seed.prefs[uid] ?? null });
        }
        return Promise.resolve({ data: rows[0] ?? null });
      },
      insert(payload: any[]) { if (table === "notifications") notifications.push(...payload); return Promise.resolve({ data: payload }); },
      then(res: any) {
        let out = rows;
        for (const [col, val] of filters) out = out.filter((r) => r[col] === val);
        for (const [col, vals] of inFilters) out = out.filter((r) => vals.includes(r[col]));
        return Promise.resolve({ data: out }).then(res);
      },
    };
    return q;
  }
  return { from: builder, _notifications: notifications } as any;
}

const baseSeed = () => ({
  rotation: [111, 222],
  wishlist: [{ user_id: "u1", item_hash: 111, notify: true }, { user_id: "u1", item_hash: 999, notify: true }],
  prefs: { u1: { email: "u1@example.com", email_enabled: true, web_push_enabled: false, web_push_subscription: null } },
  items: { 111: "Cool Emote", 222: "Some Ship" },
  notifications: [] as any[],
});

describe("notification dispatch", () => {
  it("sends one email for a newly-live wishlist item and logs dedupe", async () => {
    const db = fakeDb(baseSeed());
    let emails = 0;
    const res = await dispatchNotifications(db, {
      email: async () => { emails += 1; },
      push: async () => {},
    });
    expect(emails).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(db._notifications).toHaveLength(1);    // only the live+starred item 111
    expect(db._notifications[0].item_hash).toBe(111);
  });

  it("does not re-send when a dedupe row already exists", async () => {
    const seed = baseSeed();
    seed.notifications = [{ user_id: "u1", item_hash: 111, rotation_date: new Date().toISOString().slice(0, 10), channel: "email" }];
    const db = fakeDb(seed);
    let emails = 0;
    await dispatchNotifications(db, { email: async () => { emails += 1; }, push: async () => {} });
    expect(emails).toBe(0);
  });
});
