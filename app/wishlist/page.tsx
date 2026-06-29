"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useOverlay } from "@/components/OverlayProvider";
import { publicSupabase } from "@/lib/supabase-public";
import { bungieImg, relDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { WishlistStar } from "@/components/WishlistStar";
import { ReconnectPrompt } from "@/components/ReconnectPrompt";

type Row = { itemHash: number; name: string; iconUrl: string | null; lastSeen: string | null; appearances: number; live: boolean };

export default function WishlistPage() {
  const { auth, wishlist } = useOverlay();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (auth !== "logged_in") return;
    const hashes = Array.from(wishlist);
    if (hashes.length === 0) { setRows([]); return; }
    (async () => {
      const db = publicSupabase();
      const [{ data: items }, { data: live }, { data: seen }] = await Promise.all([
        db.from("catalog_items").select("item_hash, name, icon_url").in("item_hash", hashes),
        db.from("current_rotation").select("item_hash").in("item_hash", hashes),
        db.from("item_cadence").select("item_hash, appearances, last_seen_date").in("item_hash", hashes),
      ]);
      const liveSet = new Set((live ?? []).map((r) => Number(r.item_hash)));
      const seenMap = new Map((seen ?? []).map((r) => [Number(r.item_hash), r]));
      const out: Row[] = (items ?? []).map((i) => {
        const s = seenMap.get(Number(i.item_hash));
        return {
          itemHash: Number(i.item_hash),
          name: i.name,
          iconUrl: bungieImg(i.icon_url),
          lastSeen: (s?.last_seen_date as string) ?? null,
          appearances: (s?.appearances as number) ?? 0,
          live: liveSet.has(Number(i.item_hash)),
        };
      });
      out.sort((a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name));
      setRows(out);
    })();
  }, [auth, wishlist]);

  if (auth === "loading") return <p className="dim">Loading…</p>;
  if (auth === "logged_out")
    return <EmptyState title="Log in to use your wishlist" hint="Star items to track ownership and get notified when they return." />;

  return (
    <>
      <h1 className="page-title">Wishlist</h1>
      {auth === "needs_reauth" && <ReconnectPrompt />}
      {rows == null ? (
        <p className="dim">Loading your stars…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Your wishlist is empty" hint="Browse the catalog and star what you want." />
      ) : (
        <div className="grid">
          {rows.map((r) => (
            <article key={r.itemHash} className={`card${r.live ? " live" : ""}`}>
              {r.live && <span className="live-corner" aria-hidden>Live</span>}
              <Link href={`/item/${r.itemHash}`} className="thumb" aria-label={r.name}>
                {r.iconUrl && <img src={r.iconUrl} alt={r.name} />}
              </Link>
              <div className="body">
                <div className="meta">
                  <Link href={`/item/${r.itemHash}`} className="name" style={{ color: "var(--text)" }}>{r.name}</Link>
                  <WishlistStar itemHash={r.itemHash} />
                </div>
                <span className="dim" style={{ fontSize: "0.8rem" }}>
                  {r.live ? "In rotation today" : `Last seen ${relDate(r.lastSeen)}`} · {r.appearances} appearances
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
