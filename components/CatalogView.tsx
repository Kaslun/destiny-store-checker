"use client";
import { useState, useMemo } from "react";
import type { CatalogItem, Category } from "@/lib/types";
import { useOverlay } from "./OverlayProvider";
import { ItemCard } from "./ItemCard";
import { RotationTabs } from "./RotationTabs";
import { EmptyState } from "./EmptyState";
import { ReconnectPrompt } from "./ReconnectPrompt";

export function CatalogView({
  items, categories, itemCategories,
}: {
  items: CatalogItem[];
  categories: Category[];
  itemCategories: Record<number, string[]>;
}) {
  const { auth, owned } = useOverlay();
  const [cat, setCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      const inCat = cat === "all" || (itemCategories[i.itemHash] ?? []).includes(cat);
      const inQ = !needle || i.name.toLowerCase().includes(needle);
      return inCat && inQ;
    });
  }, [items, cat, q, itemCategories]);

  // Per-category completion (owned vs total with a collectible) for logged-in users.
  const completion = useMemo(() => {
    if (auth !== "logged_in") return null;
    const withCollectible = filtered.filter((i) => i.collectibleHash != null);
    if (withCollectible.length === 0) return null;
    const ownedCount = withCollectible.filter((i) => owned.has(i.itemHash)).length;
    return { ownedCount, total: withCollectible.length, pct: Math.round((ownedCount / withCollectible.length) * 100) };
  }, [filtered, auth, owned]);

  return (
    <>
      <h1 className="page-title">Catalog</h1>
      {auth === "needs_reauth" && <ReconnectPrompt />}
      <div className="bar">
        <RotationTabs categories={categories} active={cat} onChange={setCat} />
      </div>
      <div className="bar">
        <input
          type="search"
          placeholder="Search the Eververse catalog…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search catalog"
          style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 8,
                   border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
        />
        {completion && (
          <div style={{ minWidth: 200 }}>
            <div className="dim" style={{ fontSize: "0.8rem", marginBottom: 4 }}>
              {completion.ownedCount}/{completion.total} owned ({completion.pct}%)
            </div>
            <div className="meter" aria-label={`Collection ${completion.pct}% complete`}>
              <span style={{ width: `${completion.pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matches" hint="Try a different search or category." />
      ) : (
        <div className="grid">
          {filtered.map((i) => (
            <ItemCard
              key={i.itemHash}
              itemHash={i.itemHash}
              name={i.name}
              iconUrl={i.iconUrl}
              hasCollectible={i.collectibleHash != null}
            />
          ))}
        </div>
      )}
    </>
  );
}
