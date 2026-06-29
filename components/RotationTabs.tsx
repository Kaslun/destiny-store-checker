"use client";
import type { Category } from "@/lib/types";

export function RotationTabs({
  categories, active, onChange,
}: { categories: Category[]; active: string | "all"; onChange: (id: string | "all") => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Categories">
      <button className="tab" role="tab" aria-pressed={active === "all"} onClick={() => onChange("all")}>All</button>
      {categories.map((c) => (
        <button key={c.id} className="tab" role="tab" aria-pressed={active === c.id} onClick={() => onChange(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}
