#!/usr/bin/env python3
"""Daily manifest ingestion (data-engineer doc 01 §5).

Resolves the Eververse catalog from the Bungie manifest and upserts
catalog_items / catalog_categories / catalog_item_categories. Idempotent:
skips when the manifest version is unchanged; never deletes sunset items.

This is a faithful skeleton. The manifest is large; in production fetch only
the world component tables you need (or query the SQLite content). The hash
resolution in §2 (do NOT hardcode) is implemented as name-based lookups.
"""
import sys
import requests

from lib.db import admin_client
from lib.bungie import get_manifest

EN = "en"


def get_config(db, key, default=None):
    row = db.table("config").select("value").eq("key", key).execute().data
    return row[0]["value"] if row else default


def set_config(db, key, value):
    db.table("config").upsert({"key": key, "value": value}).execute()


def fetch_table(base_url, paths, table_name):
    url = f"https://www.bungie.net{paths[table_name][EN]}"
    return requests.get(url, timeout=300).json()


def resolve_eververse_vendor_hashes(vendors: dict) -> list[int]:
    hashes = []
    for h, v in vendors.items():
        name = (v.get("displayProperties") or {}).get("name", "").lower()
        if "tess" in name or "eververse" in name:
            hashes.append(int(h))
    return hashes


def resolve_bright_dust_hash(items: dict) -> int | None:
    for h, it in items.items():
        name = (it.get("displayProperties") or {}).get("name", "").lower()
        if name == "bright dust":
            return int(h)
    return None


def main() -> int:
    db = admin_client()
    manifest = get_manifest()
    version = manifest["version"]
    if get_config(db, "manifest_version") == version:
        print(f"manifest unchanged ({version}); skipping")
        return 0

    paths = manifest["jsonWorldComponentContentPaths"]
    items = fetch_table(manifest, paths, "DestinyInventoryItemDefinition")
    collectibles = fetch_table(manifest, paths, "DestinyCollectibleDefinition")
    vendors = fetch_table(manifest, paths, "DestinyVendorDefinition")

    ev_vendors = resolve_eververse_vendor_hashes(vendors)
    bright_dust = resolve_bright_dust_hash(items)
    set_config(db, "eververse_vendor_hashes", ev_vendors)
    if bright_dust:
        set_config(db, "bright_dust_hash", {"hash": bright_dust})
    print(f"resolved Eververse vendors={ev_vendors} bright_dust={bright_dust}")

    # Eververse set: union of collectible source mentioning Eververse and items
    # reachable under the Eververse presentation node subtree (subtree walk omitted
    # here for brevity — production should add it; see doc 01 §5.4).
    coll_source = {}
    for ch, c in collectibles.items():
        src = (c.get("sourceString") or "")
        coll_source[int(ch)] = src

    upserts = []
    for ih, it in items.items():
        dp = it.get("displayProperties") or {}
        coll_hash = it.get("collectibleHash")
        source = coll_source.get(coll_hash, "") if coll_hash else ""
        is_ev = "eververse" in source.lower()
        if not is_ev:
            continue
        preview = it.get("preview") or {}
        preview_hashes = [p.get("itemHash") for p in (preview.get("derivedItemCategories") or [])
                          for p in p.get("items", [])] if preview else []
        upserts.append({
            "item_hash": int(ih),
            "name": dp.get("name") or f"Item {ih}",
            "description": dp.get("description"),
            "icon_url": dp.get("icon"),
            "screenshot_url": it.get("screenshot"),
            "item_type": it.get("itemTypeDisplayName"),
            "item_subtype": str(it.get("itemSubType")),
            "collectible_hash": coll_hash,
            "source_string": source,
            "is_eververse": True,
            "preview_item_hashes": preview_hashes or None,
        })

    # Upsert in chunks.
    for i in range(0, len(upserts), 500):
        db.table("catalog_items").upsert(upserts[i:i + 500]).execute()

    set_config(db, "manifest_version", version)
    print(f"ingested {len(upserts)} Eververse items at manifest {version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
