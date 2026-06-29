#!/usr/bin/env python3
"""One-time: promote a logged-in Bungie account to the polling service account.

Prereq: log in to the deployed app once with the account you want to use for
polling (it needs a Destiny 2 character that has reached the Tower). That creates
its encrypted tokens in `bungie_accounts`. This script then:

  1. Finds that account's row (by --membership-id, else the most recent user).
  2. Copies its encrypted refresh/access tokens into `system_credentials`
     (key 'service_account') — same TOKEN_ENC_KEY, so the blob is reusable.
  3. Fetches a character id for the account.
  4. Prints SERVICE_MEMBERSHIP_TYPE / SERVICE_MEMBERSHIP_ID / SERVICE_CHARACTER_ID,
     which you add as GitHub Actions secrets for poll-rotation.

Idempotent: re-running just refreshes the stored service-account tokens.
"""
import argparse
import datetime as dt
import sys

from lib.db import admin_client
from lib.crypto import decrypt_token, encrypt_token
from lib.bungie import api_get, refresh_tokens_raw


def _now():
    return dt.datetime.now(dt.timezone.utc)


def valid_access_token(db, row) -> str:
    """Return a valid access token for a bungie_accounts row, refreshing if needed."""
    expires = row["access_expires_at"]
    if expires and dt.datetime.fromisoformat(expires) - dt.timedelta(seconds=60) > _now():
        return decrypt_token(row["access_token_enc"])
    t = refresh_tokens_raw(decrypt_token(row["refresh_token_enc"]))
    db.table("bungie_accounts").update({
        "access_token_enc": encrypt_token(t["access_token"]),
        "refresh_token_enc": encrypt_token(t["refresh_token"]),
        "access_expires_at": (_now() + dt.timedelta(seconds=t["expires_in"])).isoformat(),
        "refresh_expires_at": (_now() + dt.timedelta(seconds=t["refresh_expires_in"])).isoformat(),
        "updated_at": _now().isoformat(),
    }).eq("user_id", row["user_id"]).execute()
    # refresh the in-memory row so we copy the new tokens below
    row["access_token_enc"] = encrypt_token(t["access_token"])
    row["refresh_token_enc"] = encrypt_token(t["refresh_token"])
    row["access_expires_at"] = (_now() + dt.timedelta(seconds=t["expires_in"])).isoformat()
    row["refresh_expires_at"] = (_now() + dt.timedelta(seconds=t["refresh_expires_in"])).isoformat()
    return t["access_token"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--membership-id", help="bungie_membership_id of the service account; "
                                            "defaults to the most recently created user")
    args = ap.parse_args()

    db = admin_client()

    # Find the target user.
    q = db.table("users").select("id, bungie_membership_id, membership_type, display_name")
    if args.membership_id:
        q = q.eq("bungie_membership_id", args.membership_id)
    else:
        q = q.order("created_at", desc=True).limit(1)
    users = q.execute().data
    if not users:
        print("No matching user. Log in to the app with the service account first.", file=sys.stderr)
        return 1
    user = users[0]
    print(f"Using account: {user['display_name']} (membership {user['bungie_membership_id']})")

    acct = db.table("bungie_accounts").select("*").eq("user_id", user["id"]).single().execute().data
    if not acct:
        print("That user has no stored tokens. Complete an OAuth login first.", file=sys.stderr)
        return 1

    token = valid_access_token(db, acct)

    # Resolve a character id (components=200 -> characters.data keyed by id).
    mtype = user["membership_type"]
    mid = user["bungie_membership_id"]
    profile = api_get(f"/Destiny2/{mtype}/Profile/{mid}/?components=200", token)
    characters = (profile.get("characters") or {}).get("data") or {}
    if not characters:
        print("No characters found on this account.", file=sys.stderr)
        return 1
    character_id = next(iter(characters.keys()))

    # Promote tokens into system_credentials.
    db.table("system_credentials").upsert({
        "key": "service_account",
        "refresh_token_enc": acct["refresh_token_enc"],
        "access_token_enc": acct["access_token_enc"],
        "access_expires_at": acct["access_expires_at"],
        "refresh_expires_at": acct["refresh_expires_at"],
        "updated_at": _now().isoformat(),
    }).execute()

    print("\nStored service-account credentials. Add these as GitHub Actions secrets:\n")
    print(f"  SERVICE_MEMBERSHIP_TYPE = {mtype}")
    print(f"  SERVICE_MEMBERSHIP_ID   = {mid}")
    print(f"  SERVICE_CHARACTER_ID    = {character_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
