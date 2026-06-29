import { publicSupabase } from "./supabase-public";
import { bungieImg } from "./format";
import type { CatalogItem, Category, CurrencyType, RotationItem } from "./types";

function asCurrency(v: string | null): CurrencyType {
  return v === "bright_dust" || v === "silver" ? v : "other";
}

export async function getRotation(): Promise<RotationItem[]> {
  const db = publicSupabase();
  const { data } = await db
    .from("current_rotation")
    .select("item_hash, currency_type, cost_amount, sale_status, reset_at, catalog_items(name, icon_url, item_type)")
    .order("item_hash", { ascending: true });
  return (data ?? []).map((r): RotationItem => {
    const item = (r.catalog_items ?? {}) as { name?: string; icon_url?: string | null; item_type?: string | null };
    const itemType = item.item_type ?? null;
    return {
      itemHash: Number(r.item_hash),
      name: item.name ?? `Item ${r.item_hash}`,
      iconUrl: bungieImg(item.icon_url ?? null),
      currencyType: asCurrency(r.currency_type),
      costAmount: r.cost_amount,
      saleStatus: r.sale_status ?? "available",
      itemType,
      // Group the store by item type ("Shader", "Transmat Effect", ...).
      categoryId: itemType,
      resetAt: r.reset_at,
    };
  });
}

export async function getCategories(): Promise<Category[]> {
  const db = publicSupabase();
  const { data } = await db.from("catalog_categories").select("*").order("sort_order");
  return (data ?? []).map((c) => ({
    id: c.id, parentId: c.parent_id, name: c.name, sortOrder: c.sort_order ?? 0,
  }));
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const db = publicSupabase();
  const { data } = await db
    .from("catalog_items")
    .select("*")
    .eq("is_eververse", true)
    .order("name");
  return (data ?? []).map((i): CatalogItem => ({
    itemHash: Number(i.item_hash),
    name: i.name,
    description: i.description,
    iconUrl: bungieImg(i.icon_url),
    screenshotUrl: bungieImg(i.screenshot_url),
    itemType: i.item_type,
    itemSubtype: i.item_subtype,
    collectibleHash: i.collectible_hash ? Number(i.collectible_hash) : null,
    isEververse: i.is_eververse,
    typicalCurrency: i.typical_currency,
    previewItemHashes: (i.preview_item_hashes as number[] | null) ?? null,
  }));
}

export async function getItem(itemHash: number): Promise<CatalogItem | null> {
  const db = publicSupabase();
  const { data } = await db.from("catalog_items").select("*").eq("item_hash", itemHash).single();
  if (!data) return null;
  return {
    itemHash: Number(data.item_hash),
    name: data.name,
    description: data.description,
    iconUrl: bungieImg(data.icon_url),
    screenshotUrl: bungieImg(data.screenshot_url),
    itemType: data.item_type,
    itemSubtype: data.item_subtype,
    collectibleHash: data.collectible_hash ? Number(data.collectible_hash) : null,
    isEververse: data.is_eververse,
    typicalCurrency: data.typical_currency,
    previewItemHashes: (data.preview_item_hashes as number[] | null) ?? null,
  };
}

export type HistoryPoint = { date: string; cost: number | null; currency: CurrencyType };

export async function getItemHistory(itemHash: number): Promise<{
  lastSeen: string | null; appearances: number; series: HistoryPoint[];
}> {
  const db = publicSupabase();
  const { data } = await db
    .from("rotation_snapshots")
    .select("snapshot_date, cost_amount, currency_type")
    .eq("item_hash", itemHash)
    .order("snapshot_date", { ascending: true });
  const series: HistoryPoint[] = (data ?? []).map((r) => ({
    date: r.snapshot_date, cost: r.cost_amount, currency: asCurrency(r.currency_type),
  }));
  const dates = Array.from(new Set(series.map((s) => s.date)));
  return { lastSeen: dates.at(-1) ?? null, appearances: dates.length, series };
}

// Set of item_hashes that have a collectible (drives owned/missing badge presence).
export async function getCollectiblePresence(): Promise<Record<number, boolean>> {
  const db = publicSupabase();
  const { data } = await db
    .from("catalog_items")
    .select("item_hash, collectible_hash")
    .eq("is_eververse", true);
  const out: Record<number, boolean> = {};
  for (const r of data ?? []) out[Number(r.item_hash)] = r.collectible_hash != null;
  return out;
}

// Most-recent captured_at across the current rotation (for the "last updated" note).
export async function getRotationFreshness(): Promise<string | null> {
  const db = publicSupabase();
  const { data } = await db
    .from("current_rotation")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(1);
  return data?.[0]?.captured_at ?? null;
}

// Map of item_hash -> category ids, for catalog filtering.
export async function getItemCategories(): Promise<Record<number, string[]>> {
  const db = publicSupabase();
  const { data } = await db.from("catalog_item_categories").select("item_hash, category_id");
  const out: Record<number, string[]> = {};
  for (const r of data ?? []) {
    const h = Number(r.item_hash);
    (out[h] ??= []).push(r.category_id);
  }
  return out;
}

// Current rotation entry for a single item, if live.
export async function getCurrentRotationFor(itemHash: number): Promise<{ currency: CurrencyType; cost: number | null; resetAt: string | null } | null> {
  const db = publicSupabase();
  const { data } = await db
    .from("current_rotation")
    .select("currency_type, cost_amount, reset_at")
    .eq("item_hash", itemHash)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return { currency: asCurrency(row.currency_type), cost: row.cost_amount, resetAt: row.reset_at };
}

// Preview contents (bundle/engram) resolved to names+icons.
export async function getPreviewItems(hashes: number[]): Promise<{ itemHash: number; name: string; iconUrl: string | null }[]> {
  if (hashes.length === 0) return [];
  const db = publicSupabase();
  const { data } = await db.from("catalog_items").select("item_hash, name, icon_url").in("item_hash", hashes);
  return (data ?? []).map((i) => ({ itemHash: Number(i.item_hash), name: i.name, iconUrl: bungieImg(i.icon_url) }));
}
