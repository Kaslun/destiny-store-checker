"use client";
import { useOverlay } from "./OverlayProvider";
import type { CurrencyType } from "@/lib/types";

// Bright Dust affordability only. Encouraging, never shaming (doc 04 §4).
export function AffordChip({ currency, cost }: { currency: CurrencyType; cost: number | null }) {
  const { auth, brightDust } = useOverlay();
  if (auth !== "logged_in" || currency !== "bright_dust" || cost == null) return null;
  const ok = brightDust >= cost;
  return ok
    ? <span className="chip afford yes" title={`You have ${brightDust.toLocaleString()} Bright Dust`}>✓ Affordable</span>
    : <span className="chip afford no">Short by {(cost - brightDust).toLocaleString()}</span>;
}
