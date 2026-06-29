#!/usr/bin/env python3
"""Diagnostic: dump Tess Everis' category structure and map today's sale items
to the definition's named display categories (via itemList.displayCategoryIndex).
"""
import os
import sys
from collections import Counter, defaultdict

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
    vh = (get_config(db, "eververse_vendor_hashes") or [3361454721])[0]
    print(f"Inspecting vendor {vh}")

    vdef = api_get(f"/Destiny2/Manifest/DestinyVendorDefinition/{vh}/", token)
    disp = vdef.get("displayCategories") or []
    item_list = vdef.get("itemList") or []
    print(f"definition: {len(disp)} displayCategories, {len(item_list)} items in itemList")

    # Map vendorItemIndex -> displayCategoryIndex from the definition.
    idx_to_dci = {}
    for it in item_list:
        vi = it.get("vendorItemIndex")
        if vi is not None:
            idx_to_dci[vi] = it.get("displayCategoryIndex")

    def cat_name(dci):
        if dci is not None and 0 <= dci < len(disp):
            return (disp[dci].get("displayProperties") or {}).get("name") or f"idx {dci}"
        return f"idx {dci}"

    # Today's live sales (plural call).
    plural = api_get(
        f"/Destiny2/{mtype}/Profile/{mid}/Character/{cid}/Vendors/?components=400,401,402",
        token,
    )
    psales = ((plural.get("sales") or {}).get("data") or {}).get(str(vh), {}).get("saleItems") or {}
    print(f"today: {len(psales)} sale items")

    counts = Counter()
    samples = defaultdict(list)
    for idx_str, sale in psales.items():
        try:
            vi = int(idx_str)
        except ValueError:
            continue
        nm = cat_name(idx_to_dci.get(vi))
        counts[nm] += 1
        if len(samples[nm]) < 4:
            samples[nm].append(sale.get("itemHash"))

    print("today's sales grouped by definition displayCategory:")
    for nm, c in counts.most_common():
        print(f"  '{nm}' -> {c} items (sample hashes {samples[nm]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
