"use client";
import { useState, useMemo, useEffect } from "react";
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
  rotation, hasCollectible, stale, previousDate,
}: {
  rotation: RotationItem[];
  hasCollectible: Record<number, boolean>;
  stale: { updatedAt: string | null };
  previousDate: string | null;
}) {
  const { auth, wishlist } = useOverlay();
  const [cat, setCat] = useState<string | "all">("all");
  const [cur, setCur] = useState<CurrencyChoice>("all");

  // "Today's offers" = items that changed vs the previous snapshot day. Only
  // meaningful once a prior day exists; until then we show everything.
  const calibrated = previousDate !== null && rotation.some((r) => r.isNew);
  const [view, setView] = useState<"today" | "all">("all");
  useEffect(() => { if (calibrated) setView("today"); }, [calibrated]);

  const resetAt = rotation.find((r) => r.resetAt)?.resetAt ?? null;
  const names = Object.fromEntries(rotation.map((r) => [r.itemHash, r.name]));
  const liveHashes = rotation.map((r) => r.itemHash);

  // The list the current view operates on.
  const base = useMemo(
    () => (view === "today" && calibrated ? rotation.filter((r) => r.isNew) : rotation),
    [rotation, view, calibrated]
  );

  // Tabs are the item types present in the current view, by count then name.
  const tabs: Category[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of base) {
      if (r.categoryId) counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id], i) => ({ id, parentId: null, name: id, sortOrder: i }));
  }, [base]);

  const shown = useMemo(
    () => base.filter((r) =>
      (cat === "all" || r.categoryId === cat) && matchesCurrency(cur, r.currencyType)),
    [base, cat, cur]
  );

  return (
    <>
      <h1 className="page-title">Today&apos;s rotation</h1>
      {auth === "needs_reauth" && <ReconnectPrompt />}
      <LiveBanner liveHashes={liveHashes} names={names} />

      <div className="bar">
        {calibrated && (
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === "today"} onClick={() => setView("today")}>Today&apos;s offers</button>
            <button aria-pressed={view === "all"} onClick={() => setView("all")}>All items</button>
          </div>
        )}
        <RotationTabs categories={tabs} active={cat} onChange={setCat} />
        <span className="spacer" style={{ flex: 1 }} />
        <CurrencyFilter value={cur} onChange={setCur} />
        <ResetCountdown resetAt={resetAt} />
      </div>

      {!calibrated && (
        <p className="dim" style={{ fontSize: "0.8rem", marginTop: 0 }}>
          Showing everything Tess sells today. The daily-offer view turns on after the next reset,
          once there&apos;s a previous day to compare against.
        </p>
      )}
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
