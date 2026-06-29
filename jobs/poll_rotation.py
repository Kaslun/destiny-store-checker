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


def main() -> int:
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

    for vendor_hash in vendor_hashes:
        path = (f"/Destiny2/{SERVICE_MEMBERSHIP_TYPE}/Profile/{SERVICE_MEMBERSHIP_ID}"
                f"/Character/{SERVICE_CHARACTER_ID}/Vendors/{vendor_hash}/?components=400,401,402")
        resp = api_get(path, token)
        sales = (resp.get("sales") or {}).get("data") or {}
        vendor = (resp.get("vendor") or {}).get("data") or {}
        reset_at = vendor.get("nextRefreshDate")

        for _idx, sale in sales.items():
            item_hash = sale.get("itemHash")
            costs = sale.get("costs") or []
            cost = costs[0] if costs else {}
            cost_hash = cost.get("itemHash")
            currency = ("bright_dust" if cost_hash and cost_hash == bright_dust_hash
                        else "silver" if cost_hash else "other")
            sale_status = {0: "available", 1: "sold_out"}.get(sale.get("saleStatus"), "available")
            current_rows.append({
                "vendor_hash": vendor_hash, "item_hash": item_hash, "category_id": None,
                "currency_type": currency, "cost_currency_hash": cost_hash,
                "cost_amount": cost.get("quantity"), "sale_status": sale_status,
                "quantity": sale.get("quantity"), "reset_at": reset_at,
            })
            snapshot_rows.append({
                "snapshot_date": today, "vendor_hash": vendor_hash, "item_hash": item_hash,
                "currency_type": currency, "cost_amount": cost.get("quantity"),
                "sale_status": sale_status, "raw": sale,
            })

    # Replace current_rotation atomically-ish: clear then insert.
    db.table("current_rotation").delete().neq("id", -1).execute()
    if current_rows:
        db.table("current_rotation").insert(current_rows).execute()

    # Append snapshots; the unique index (date,vendor,item) makes re-runs no-ops.
    if snapshot_rows:
        db.table("rotation_snapshots").upsert(
            snapshot_rows, on_conflict="snapshot_date,vendor_hash,item_hash"
        ).execute()

    print(f"polled {len(current_rows)} sale items across {len(vendor_hashes)} vendors")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # fail loudly — a silent failure freezes the feed
        print(f"poll-rotation FAILED: {e}", file=sys.stderr)
        sys.exit(1)
