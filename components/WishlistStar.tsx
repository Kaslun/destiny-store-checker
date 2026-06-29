"use client";
import { useOverlay } from "./OverlayProvider";

export function WishlistStar({ itemHash }: { itemHash: number }) {
  const { wishlist, toggleStar, auth } = useOverlay();
  const starred = wishlist.has(itemHash);
  const label = auth !== "logged_in" ? "Log in to star this item" : starred ? "Unstar" : "Star this item";
  return (
    <button
      className="star"
      aria-pressed={starred}
      aria-label={label}
      title={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStar(itemHash); }}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}
