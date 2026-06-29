"use client";
import { useState, useMemo } from "react";
import type { Category, RotationItem } from "@/lib/types";
import { useOverlay } from "./OverlayProvider";
import { RotationTabs } from "./RotationTabs";
import { CurrencyFilter, matchesCurrency, type CurrencyChoice } from "./CurrencyFilter";
import { ResetCountdown } from "./ResetCountdown";
import { LiveBanner } from "./LiveBanner";
import { ItemCard } from "./ItemCard";
import { ReconnectPrompt } from "./ReconnectPrompt";
import { EmptyState } from "./EmptyState";

export function StoreView({
  rotation, categories, hasCollectible, stale,
}: {
  rotation: RotationItem[];
  categories: Category[];
  hasCollectible: Record<number, boolean>;
  stale: { updatedAt: string | null };
}) {
  const { auth, wishlist } = useOverlay();
  const [cat, setCat] = useState<string | "all">("all");
  const [cur, setCur] = useState<CurrencyChoice>("all");

  const resetAt = rotation.find((r) => r.resetAt)?.resetAt ?? null;
  const names = Object.fromEntries(rotation.map((r) => [r.itemHash, r.name]));
  const liveHashes = rotation.map((r) => r.itemHash);

  // Tabs come from categories actually present in the rotation (data-driven).
  const presentCatIds = new Set(rotation.map((r) => r.categoryId).filter(Boolean) as string[]);
  const tabs = categories.filter((c) => presentCatIds.has(c.id));

  const shown = useMemo(
    () => rotation.filter((r) =>
      (cat === "all" || r.categoryId === cat) && matchesCurrency(cur, r.currencyType)),
    [rotation, cat, cur]
  );

  return (
    <>
      <h1 className="page-title">Today&apos;s rotation</h1>
      {auth === "needs_reauth" && <ReconnectPrompt />}
      <LiveBanner liveHashes={liveHashes} names={names} />

      <div className="bar">
        <RotationTabs categories={tabs} active={cat} onChange={setCat} />
        <span className="spacer" style={{ flex: 1 }} />
        <CurrencyFilter value={cur} onChange={setCur} />
        <ResetCountdown resetAt={resetAt} />
      </div>

      {stale.updatedAt && (
        <p className="dim" style={{ fontSize: "0.8rem", marginTop: 0 }}>
          Last updated {new Date(stale.updatedAt).toLocaleString()}.
        </p>
      )}

      {rotation.length === 0 ? (
        <EmptyState title="No rotation data yet" hint="The poller fills this in around each reset." />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing matches this filter" />
      ) : (
        <div className="grid">
          {shown.map((r) => (
            <ItemCard
              key={r.itemHash}
              itemHash={r.itemHash}
              name={r.name}
              iconUrl={r.iconUrl}
              currencyType={r.currencyType}
              costAmount={r.costAmount}
              hasCollectible={!!hasCollectible[r.itemHash]}
              live={wishlist.has(r.itemHash)}
            />
          ))}
        </div>
      )}
    </>
  );
}
