"use client";
import type { CurrencyType } from "@/lib/types";

export type CurrencyChoice = "all" | "bright_dust" | "silver";

export function CurrencyFilter({ value, onChange }: { value: CurrencyChoice; onChange: (c: CurrencyChoice) => void }) {
  const opts: { v: CurrencyChoice; label: string }[] = [
    { v: "all", label: "All" },
    { v: "bright_dust", label: "Bright Dust" },
    { v: "silver", label: "Silver" },
  ];
  return (
    <div className="seg" role="group" aria-label="Filter by currency">
      {opts.map((o) => (
        <button key={o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export function matchesCurrency(choice: CurrencyChoice, c: CurrencyType): boolean {
  if (choice === "all") return true;
  return c === choice;
}
