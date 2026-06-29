import type { CurrencyType } from "./types";

const ICON_BASE = "https://www.bungie.net";

// Bungie manifest paths are root-relative; prefix the host.
export function bungieImg(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${ICON_BASE}${path}`;
}

export function currencyLabel(c: CurrencyType): string {
  if (c === "bright_dust") return "Bright Dust";
  if (c === "silver") return "Silver";
  return "Other";
}

export function formatCost(amount: number | null, c: CurrencyType): string {
  if (amount == null) return "—";
  return `${amount.toLocaleString()} ${currencyLabel(c)}`;
}

// Countdown parts to the next reset.
export function countdownParts(resetAt: string | null, now = Date.now()) {
  if (!resetAt) return null;
  const diff = new Date(resetAt).getTime() - now;
  if (diff <= 0) return { refreshing: true, h: 0, m: 0, s: 0 };
  const s = Math.floor(diff / 1000);
  return { refreshing: false, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function relDate(date: string | null): string {
  if (!date) return "never seen";
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
