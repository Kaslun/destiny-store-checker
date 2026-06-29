"use client";
import { WishlistStar } from "./WishlistStar";
export function ItemDetailStar({ itemHash }: { itemHash: number }) {
  return <WishlistStar itemHash={itemHash} />;
}
