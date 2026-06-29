#!/usr/bin/env python3
"""Diagnostic: dump Tess Everis' category structure so we can isolate the
daily-offer categories. Tries singular AND plural vendor calls plus the vendor
definition, and prints category names with item counts.
"""
import os
import sys

from lib.db import admin_client
from lib.bungie import get_service_access_token, api_get


def get_config(db, key, default=None):
    r = db.table("config").select("value").eq("key", key).execute().data
    return r[0]["value"] if r else default


def resolve_names(vdef, live_categories):
    disp = vdef.get("displayCategories") or []
    out = []
    for c in live_categories:
        di = c.get("displayCategoryIndex")
        name = ""
        ident = ""
        if di is not None and di < len(disp):
            dc = disp[di] or {}
            name = (dc.get("displayProperties") or {}).get("name") or ""
            ident = dc.get("identifier") or ""
        out.append((di, name, ident, len(c.get("itemIndexes") or [])))
    return out


def main() -> int:
    db = admin_client()
    token = get_service_access_token(db)
    mtype = os.environ["SERVICE_MEMBERSHIP_TYPE"]
    mid = os.environ["SERVICE_MEMBERSHIP_ID"]
    cid = os.environ["SERVICE_CHARACTER_ID"]
    vh = (get_config(db, "eververse_vendor_hashes") or [3361454721])[0]
    print(f"Inspecting vendor {vh}")

    vdef = api_get(f"/Destiny2/Manifest/DestinyVendorDefinition/{vh}/", token)
    disp = vdef.get("displayCategories") or []
    print(f"\\nvendor definition has {len(disp)} displayCategories:")
    for i, dc in enumerate(disp):
        nm = (dc.get("displayProperties") or {}).get("name") or ""
        print(f"  [{i}] name='{nm}' identifier='{dc.get('identifier')}'")

    # Singular GetVendor
    try:
        single = api_get(
            f"/Destiny2/{mtype}/Profile/{mid}/Character/{cid}/Vendors/{vh}/?components=400,401,402",
            token,
        )
        scats = ((single.get("categories") or {}).get("data") or {}).get("categories") or []
        ssales = (single.get("sales") or {}).get("data") or {}
        print(f"\\nSINGULAR: {len(scats)} live categories, {len(ssales)} sales")
        for di, name, ident, n in resolve_names(vdef, scats):
            print(f"  cat idx={di} '{name}' [{ident}] -> {n} items")
    except Exception as e:
        print(f"\\nSINGULAR failed: {e}")

    # Plural GetVendors
    plural = api_get(
        f"/Destiny2/{mtype}/Profile/{mid}/Character/{cid}/Vendors/?components=400,401,402",
        token,
    )
    pcats = ((plural.get("categories") or {}).get("data") or {}).get(str(vh), {}).get("categories") or []
    psales = ((plural.get("sales") or {}).get("data") or {}).get(str(vh), {}).get("saleItems") or {}
    print(f"\\nPLURAL: {len(pcats)} live categories, {len(psales)} sales")
    for di, name, ident, n in resolve_names(vdef, pcats):
        print(f"  cat idx={di} '{name}' [{ident}] -> {n} items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
