"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useOverlay } from "./OverlayProvider";

export function LiveBanner({ liveHashes, names }: { liveHashes: number[]; names: Record<number, string> }) {
  const { wishlist, auth } = useOverlay();
  const [dismissed, setDismissed] = useState(false);
  const hits = useMemo(() => liveHashes.filter((h) => wishlist.has(h)), [liveHashes, wishlist]);
  if (auth !== "logged_in" || hits.length === 0 || dismissed) return null;
  return (
    <div className="banner" role="status">
      <span aria-hidden style={{ fontSize: "1.3rem" }}>★</span>
      <div style={{ flex: 1 }}>
        <strong>{hits.length} of your wishlist {hits.length === 1 ? "item is" : "items are"} live today.</strong>
        <div className="dim" style={{ fontSize: "0.85rem" }}>
          {hits.map((h, i) => (
            <span key={h}>
              <Link href={`/item/${h}`}>{names[h] ?? `Item ${h}`}</Link>{i < hits.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      </div>
      <button className="btn secondary" onClick={() => setDismissed(true)}>Dismiss for now</button>
    </div>
  );
}
