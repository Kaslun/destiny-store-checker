"""Bungie API helpers for the scheduled jobs.

The jobs authenticate to Bungie with the SERVICE ACCOUNT, whose refresh token
lives encrypted in system_credentials. We refresh + persist it here so the job
can run unattended (data-engineer doc 01 §6, backend doc 02 §4).
"""
import base64
import datetime as dt
import os
import requests

from .crypto import encrypt_token, decrypt_token

PLATFORM = "https://www.bungie.net/Platform"
TOKEN_URL = "https://www.bungie.net/Platform/App/OAuth/token/"


def _basic_auth() -> str:
    raw = f"{os.environ['BUNGIE_CLIENT_ID']}:{os.environ['BUNGIE_CLIENT_SECRET']}"
    return "Basic " + base64.b64encode(raw.encode()).decode()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def refresh_tokens_raw(refresh_token: str) -> dict:
    """Exchange a refresh token for a new token set (confidential client)."""
    resp = requests.post(
        TOKEN_URL,
        headers={"Authorization": _basic_auth(), "X-API-Key": os.environ["BUNGIE_API_KEY"],
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_service_access_token(db) -> str:
    """Return a valid service-account access token, refreshing if expired."""
    row = db.table("system_credentials").select("*").eq("key", "service_account").single().execute().data
    if not row:
        raise RuntimeError("service_account credentials missing in system_credentials")

    expires = row.get("access_expires_at")
    if row.get("access_token_enc") and expires and dt.datetime.fromisoformat(expires) - dt.timedelta(seconds=60) > _now():
        return decrypt_token(row["access_token_enc"])

    # Refresh.
    t = refresh_tokens_raw(decrypt_token(row["refresh_token_enc"]))
    db.table("system_credentials").update({
        "access_token_enc": encrypt_token(t["access_token"]),
        "refresh_token_enc": encrypt_token(t["refresh_token"]),
        "access_expires_at": (_now() + dt.timedelta(seconds=t["expires_in"])).isoformat(),
        "refresh_expires_at": (_now() + dt.timedelta(seconds=t["refresh_expires_in"])).isoformat(),
        "updated_at": _now().isoformat(),
    }).eq("key", "service_account").execute()
    return t["access_token"]


def api_get(path: str, access_token: str) -> dict:
    resp = requests.get(
        f"{PLATFORM}{path}",
        headers={"X-API-Key": os.environ["BUNGIE_API_KEY"], "Authorization": f"Bearer {access_token}"},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("ErrorCode", 1) != 1:
        raise RuntimeError(f"Bungie API error {data.get('ErrorCode')}: {data.get('Message')}")
    return data["Response"]


def get_manifest() -> dict:
    resp = requests.get(f"{PLATFORM}/Destiny2/Manifest/",
                        headers={"X-API-Key": os.environ["BUNGIE_API_KEY"]}, timeout=60)
    resp.raise_for_status()
    return resp.json()["Response"]
