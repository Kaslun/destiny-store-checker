"use client";
import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/format";

export function ResetCountdown({ resetAt }: { resetAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!resetAt) return null;
  const p = now == null ? null : countdownParts(resetAt, now);
  if (!p) return <span className="chip mono">—</span>;
  if (p.refreshing) return <span className="chip" role="status">Refreshing rotation…</span>;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="chip mono" aria-label="Time until next reset">
      ⟳ {p.h}h {pad(p.m)}m {pad(p.s)}s
    </span>
  );
}
