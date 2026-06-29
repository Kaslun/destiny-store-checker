#!/usr/bin/env python3
"""One-off discovery: list the vendors the service-account character can see,
and flag the Eververse store(s) — the ones selling for Bright Dust — with their
display category names. Use the output to wire poll_rotation to the right vendor.
"""
import os
import sys

from lib.db import admin_client
from lib.bungie import get_service_access_token, api_get


def get_config(db, key, default=None):
    r = db.table("config").select("value").eq("key", key).execute().data
    return r[0]["value"] if r else default


def main() -> int:
    db = admin_client()
    token = get_service_access_token(db)
    mtype = os.environ["SERVICE_MEMBERSHIP_TYPE"]
    mid = os.environ["SERVICE_MEMBERSHIP_ID"]
    cid = os.environ["SERVICE_CHARACTER_ID"]
    bright_dust = (get_config(db, "bright_dust_hash") or {}).get("hash")

    resp = api_get(
        f"/Destiny2/{mtype}/Profile/{mid}/Character/{cid}/Vendors/?components=400,401,402",
        token,
    )
    vendors = (resp.get("vendors") or {}).get("data") or {}
    categories = (resp.get("categories") or {}).get("data") or {}
    sales = (resp.get("sales") or {}).get("data") or {}
    print(f"{len(vendors)} vendors visible to the character; bright_dust_hash={bright_dust}")

    daily_store = []   # vendors whose categories look like the in-game daily offers
    bright_dust_vendors = []

    for vh in vendors:
        sale_items = (sales.get(vh) or {}).get("saleItems") or {}
        n = len(sale_items)
        sells_bd = any(
            c.get("itemHash") == bright_dust
            for s in sale_items.values()
            for c in (s.get("costs") or [])
        )
        try:
            vdef = api_get(f"/Destiny2/Manifest/DestinyVendorDefinition/{vh}/", token)
        except Exception:
            vdef = {}
        name = ((vdef.get("displayProperties") or {}).get("name") or "").strip()
        disp = vdef.get("displayCategories") or []
        live_cats = (categories.get(vh) or {}).get("categories") or []
        cat_names = []
        for c in live_cats:
            di = c.get("displayCategoryIndex")
            if di is not None and di < len(disp):
                nm = ((disp[di].get("displayProperties") or {}).get("name") or "").strip()
                if nm:
                    cat_names.append(f"{nm}({len(c.get('itemIndexes') or [])})")

        # Only print likely Eververse candidates to keep the log focused.
        cat_blob = " ".join(cat_names).lower()
        is_daily = ("offer" in cat_blob) or ("bright dust" in cat_blob)
        if sells_bd:
            bright_dust_vendors.append(int(vh))
        if is_daily and sells_bd:
            daily_store.append(int(vh))
        if sells_bd or is_daily or any(k in name.lower() for k in ("tess", "eververse", "bright", "monument", "store")):
            print(f"VENDOR {vh} '{name}' sales={n} sells_bright_dust={sells_bd} daily={is_daily}")
            print(f"    categories: {cat_names}")

    chosen = daily_store or bright_dust_vendors
    if chosen:
        db.table("config").upsert({"key": "eververse_vendor_hashes", "value": chosen}).execute()
        print(f"\nWrote eververse_vendor_hashes = {chosen} "
              f"({'daily-store match' if daily_store else 'bright-dust fallback'}). "
              "Run poll-rotation next.")
    else:
        print("\nNo Eververse/daily vendor identified. Paste the VENDOR lines above.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
