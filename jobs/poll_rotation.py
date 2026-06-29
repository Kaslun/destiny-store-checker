#!/usr/bin/env python3
"""Rotation poll (data-engineer doc 01 §6). Runs around resets.

Reads the live Eververse rotation via the service account, overwrites
current_rotation, and appends to rotation_snapshots (the irreplaceable history).
Exits non-zero on failure so a frozen feed is visible (doc 01 §6 / 05 §4).
"""
import datetime as dt
import os
import sys

from lib.db import admin_client
from lib.bungie import get_service_access_token, api_get

# Service account membership + a character that has reached the Tower.
SERVICE_MEMBERSHIP_TYPE = os.environ.get("SERVICE_MEMBERSHIP_TYPE")
SERVICE_MEMBERSHIP_ID = os.environ.get("SERVICE_MEMBERSHIP_ID")
SERVICE_CHARACTER_ID = os.environ.get("SERVICE_CHARACTER_ID")


def get_config(db, key, default=None):
    row = db.table("config").select("value").eq("key", key).execute().data
    return row[0]["value"] if row else default


def ensure_catalog_items(db, token, item_hashes):
    """Make sure every sale item exists in catalog_items (current_rotation has an
    FK to it). The manifest ingest only flags collectible-sourced Eververse items,
    but the live rotation sells more, so backfill any missing ones by fetching
    their definition. Self-correcting: the catalog grows from real rotations."""
    hashes = sorted({h for h in item_hashes if h})
    if not hashes:
        return
    existing = set()
    for i in range(0, len(hashes), 200):
        chunk = hashes[i:i + 200]
        rows = db.table("catalog_items").select("item_hash").in_("item_hash", chunk).execute().data
        existing.update(int(r["item_hash"]) for r in rows)
    missing = [h for h in hashes if h not in existing]
    if not missing:
        return
    print(f"  backfilling {len(missing)} catalog item(s) referenced by the rotation")
    upserts = []
    for h in missing:
        try:
            d = api_get(f"/Destiny2/Manifest/DestinyInventoryItemDefinition/{h}/", token)
        except RuntimeError as e:
            print(f"    item {h}: definition fetch failed ({e})")
            continue
        dp = d.get("displayProperties") or {}
        upserts.append({
            "item_hash": h,
            "name": dp.get("name") or f"Item {h}",
            "description": dp.get("description"),
            "icon_url": dp.get("icon"),
            "screenshot_url": d.get("screenshot"),
            "item_type": d.get("itemTypeDisplayName"),
            "item_subtype": str(d.get("itemSubType")),
            "collectible_hash": d.get("collectibleHash"),
            "is_eververse": True,
        })
    for i in range(0, len(upserts), 500):
        db.table("catalog_items").upsert(upserts[i:i + 500]).execute()


def main() -> int:
    # Fail fast with a clear message if the service-account identity is unset,
    # rather than building a malformed URL and getting a confusing 404.
    missing = [n for n in ("SERVICE_MEMBERSHIP_TYPE", "SERVICE_MEMBERSHIP_ID", "SERVICE_CHARACTER_ID")
               if not os.environ.get(n)]
    if missing:
        print(f"Missing required secrets: {', '.join(missing)}. "
              "Add them as repository secrets (values from the seed-service-account log).",
              file=sys.stderr)
        return 1

    db = admin_client()
    token = get_service_access_token(db)

    vendor_hashes = get_config(db, "eververse_vendor_hashes", [])
    bright_dust_hash = (get_config(db, "bright_dust_hash") or {}).get("hash")
    if not vendor_hashes:
        print("no resolved Eververse vendor hashes; run manifest_ingest first", file=sys.stderr)
        return 1

    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    current_rows = []
    snapshot_rows = []
    category_rows = {}   # id -> catalog_categories row (deduped)

    print(f"trying {len(vendor_hashes)} resolved Eververse vendor(s): {vendor_hashes}")
    ok_vendors = 0
    for vendor_hash in vendor_hashes:
        path = (f"/Destiny2/{SERVICE_MEMBERSHIP_TYPE}/Profile/{SERVICE_MEMBERSHIP_ID}"
                f"/Character/{SERVICE_CHARACTER_ID}/Vendors/{vendor_hash}/?components=400,401,402")
        try:
            resp = api_get(path, token)
        except RuntimeError as e:
            # Not every name-matched vendor is queryable (display/category or
            # inactive seasonal vendors). Skip and keep going.
            print(f"  vendor {vendor_hash}: skipped ({e})")
            continue

        sales = (resp.get("sales") or {}).get("data") or {}
        vendor = (resp.get("vendor") or {}).get("data") or {}
        reset_at = vendor.get("nextRefreshDate")

        # Eververse is organized into display categories (Featured, Bright Dust,
        # Shaders, Finishers, Transmat Effects, ...). Their names live in the
        # vendor definition; component 401 maps each category to vendorItemIndexes.
        try:
            vdef = api_get(f"/Destiny2/Manifest/DestinyVendorDefinition/{vendor_hash}/", token)
        except RuntimeError:
            vdef = {}
        display_categories = vdef.get("displayCategories") or []
        live_categories = ((resp.get("categories") or {}).get("data") or {}).get("categories") or []
        index_to_cat = {}
        for c in live_categories:
            di = c.get("displayCategoryIndex")
            if di is None or di >= len(display_categories):
                continue
            dc = display_categories[di] or {}
            name = ((dc.get("displayProperties") or {}).get("name") or "").strip()
            if not name:
                continue  # skip unnamed/structural dividers
            cat_id = f"{vendor_hash}:{di}"
            category_rows[cat_id] = {
                "id": cat_id, "parent_id": None, "name": name,
                "sort_order": di, "source": "vendor_category",
            }
            for idx in c.get("itemIndexes") or []:
                index_to_cat[idx] = cat_id

        ok_vendors += 1
        print(f"  vendor {vendor_hash}: {len(sales)} sale items, "
              f"{len(category_rows)} categories, {len(index_to_cat)} categorized indexes")

        for idx_str, sale in sales.items():
            try:
                idx = int(idx_str)
            except (TypeError, ValueError):
                idx = sale.get("vendorItemIndex")
            category_id = index_to_cat.get(idx)
            item_hash = sale.get("itemHash")
            costs = sale.get("costs") or []
            cost = costs[0] if costs else {}
            cost_hash = cost.get("itemHash")
            currency = ("bright_dust" if cost_hash and cost_hash == bright_dust_hash
                        else "silver" if cost_hash else "other")
            sale_status = {0: "available", 1: "sold_out"}.get(sale.get("saleStatus"), "available")
            current_rows.append({
                "vendor_hash": vendor_hash, "item_hash": item_hash, "category_id": category_id,
                "currency_type": currency, "cost_currency_hash": cost_hash,
                "cost_amount": cost.get("quantity"), "sale_status": sale_status,
                "quantity": sale.get("quantity"), "reset_at": reset_at,
            })
            snapshot_rows.append({
                "snapshot_date": today, "vendor_hash": vendor_hash, "item_hash": item_hash,
                "currency_type": currency, "cost_amount": cost.get("quantity"),
                "sale_status": sale_status, "raw": sale,
            })

    # Keep only items shown in a store category (that is what a player sees in
    # Eververse). Fallback: if category mapping resolved nothing, keep everything
    # so we never blank the store on an unexpected manifest shape.
    categorized = [r for r in current_rows if r["category_id"] is not None]
    if categorized:
        kept = {(r["vendor_hash"], r["item_hash"]) for r in categorized}
        dropped = len(current_rows) - len(categorized)
        current_rows = categorized
        snapshot_rows = [r for r in snapshot_rows if (r["vendor_hash"], r["item_hash"]) in kept]
        if dropped:
            print(f"  ({dropped} uncategorized sale entries skipped)")
    else:
        print("  (no category mapping resolved; keeping all sale items as fallback)")

    # A vendor can list the same item in multiple sale slots. Dedupe before
    # writing, else the batched upserts hit the same row twice (Postgres 21000).
    cur_by_key = {(r["vendor_hash"], r["item_hash"]): r for r in current_rows}
    current_rows = list(cur_by_key.values())
    snap_by_key = {(r["snapshot_date"], r["vendor_hash"], r["item_hash"]): r for r in snapshot_rows}
    snapshot_rows = list(snap_by_key.values())

    # Upsert the store categories so the frontend tabs match Eververse's sections.
    if category_rows:
        db.table("catalog_categories").upsert(list(category_rows.values())).execute()

    # Ensure FK targets exist before inserting current_rotation.
    ensure_catalog_items(db, token, [r["item_hash"] for r in current_rows])

    # Replace current_rotation atomically-ish: clear then insert.
    db.table("current_rotation").delete().neq("id", -1).execute()
    if current_rows:
        db.table("current_rotation").insert(current_rows).execute()

    # Append snapshots; the unique index (date,vendor,item) makes re-runs no-ops.
    if snapshot_rows:
        db.table("rotation_snapshots").upsert(
            snapshot_rows, on_conflict="snapshot_date,vendor_hash,item_hash"
        ).execute()

    if ok_vendors == 0:
        print("No Eververse vendor was queryable. The resolved hashes may all be "
              "non-interactable vendors; widen/repair resolution in manifest_ingest.", file=sys.stderr)
        return 1
    by_cur = {}
    for r in current_rows:
        by_cur[r["currency_type"]] = by_cur.get(r["currency_type"], 0) + 1
    print(f"polled {len(current_rows)} items across {ok_vendors}/{len(vendor_hashes)} vendors; "
          f"by currency: {by_cur}; {len(category_rows)} categories")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # fail loudly — a silent failure freezes the feed
        print(f"poll-rotation FAILED: {e}", file=sys.stderr)
        sys.exit(1)
