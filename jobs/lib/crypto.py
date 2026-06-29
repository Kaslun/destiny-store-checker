"""AES-256-GCM token codec, wire-compatible with lib/crypto.ts.

Payload format: base64(iv):base64(tag):base64(ciphertext)
TOKEN_ENC_KEY is base64 of 32 bytes.
"""
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key() -> bytes:
    # Be lenient like Node's Buffer.from(x, "base64"): strip whitespace and
    # restore missing "=" padding, so a stray newline or dropped "=" in the
    # secret doesn't break decoding.
    raw = os.environ["TOKEN_ENC_KEY"].strip()
    raw += "=" * (-len(raw) % 4)
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError(
            f"TOKEN_ENC_KEY must decode to 32 bytes, got {len(key)}. "
            "Check it matches the value set in Vercel exactly."
        )
    return key


def encrypt_token(plaintext: str) -> str:
    iv = os.urandom(12)
    aes = AESGCM(_key())
    ct_and_tag = aes.encrypt(iv, plaintext.encode(), None)  # tag appended (last 16 bytes)
    ct, tag = ct_and_tag[:-16], ct_and_tag[-16:]
    return ":".join(base64.b64encode(b).decode() for b in (iv, tag, ct))


def decrypt_token(payload: str) -> str:
    iv_b64, tag_b64, ct_b64 = payload.split(":")
    iv = base64.b64decode(iv_b64)
    tag = base64.b64decode(tag_b64)
    ct = base64.b64decode(ct_b64)
    aes = AESGCM(_key())
    return aes.decrypt(iv, ct + tag, None).decode()
