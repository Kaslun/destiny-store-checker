"use client";
import { useOverlay } from "./OverlayProvider";

// Owned/missing badge. Color + icon + text (state never by color alone).
export function OwnedBadge({ itemHash, hasCollectible }: { itemHash: number; hasCollectible: boolean }) {
  const { auth, owned, missing } = useOverlay();
  if (auth !== "logged_in" || !hasCollectible) return null;
  if (owned.has(itemHash)) return <span className="badge owned">✓ Owned</span>;
  if (missing.has(itemHash)) return <span className="badge missing">＋ Missing</span>;
  return null;
}
