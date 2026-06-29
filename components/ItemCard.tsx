"use client";
import Link from "next/link";
import Image from "next/image";
import { formatCost } from "@/lib/format";
import type { CurrencyType } from "@/lib/types";
import { WishlistStar } from "./WishlistStar";
import { OwnedBadge } from "./OwnedBadge";
import { AffordChip } from "./AffordChip";

export type ItemCardProps = {
  itemHash: number;
  name: string;
  iconUrl: string | null;
  currencyType?: CurrencyType;
  costAmount?: number | null;
  hasCollectible: boolean;
  live?: boolean;            // starred-and-live highlight
};

export function ItemCard(p: ItemCardProps) {
  return (
    <article className={`card${p.live ? " live" : ""}`}>
      {p.live && <span className="live-corner" aria-hidden>Live</span>}
      <Link href={`/item/${p.itemHash}`} className="thumb" aria-label={p.name}>
        {p.iconUrl ? (
          <Image src={p.iconUrl} alt={p.name} width={300} height={300} unoptimized />
        ) : (
          <span aria-hidden />
        )}
      </Link>
      <div className="body">
        <div className="meta">
          <Link href={`/item/${p.itemHash}`} className="name" style={{ color: "var(--text)" }}>{p.name}</Link>
          <WishlistStar itemHash={p.itemHash} />
        </div>
        <div className="meta">
          {p.currencyType ? (
            <span className="cost">{formatCost(p.costAmount ?? null, p.currencyType)}</span>
          ) : <span />}
          <OwnedBadge itemHash={p.itemHash} hasCollectible={p.hasCollectible} />
        </div>
        {p.live && <span className="badge" style={{ color: "var(--live)" }}>★ In rotation today</span>}
        {p.currencyType && <AffordChip currency={p.currencyType} cost={p.costAmount ?? null} />}
      </div>
    </article>
  );
}
