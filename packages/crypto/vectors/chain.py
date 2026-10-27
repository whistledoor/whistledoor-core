"""Test vectors for src/chain.ts (crypto-design.md section 5, message chain).

Builds a case of three messages without libsodium: each message is
`0x01 || nonce || secretbox(json, nonce, caseKey)` and `prev` is
crypto_generichash(32) (BLAKE2b-256, no key) of the previous stored ciphertext,
base64url without padding.

Run: python3 -I packages/crypto/vectors/chain.py
"""
import base64
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reference import secretbox  # noqa: E402

VERSION = b"\x01"


def fixed(label: str, size: int) -> bytes:
    """Random-looking but reproducible bytes."""
    return hashlib.blake2b(label.encode(), digest_size=size).digest()


def message_hash(ciphertext: bytes) -> str:
    digest = hashlib.blake2b(ciphertext, digest_size=32).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


case_key = fixed("chain case key", 32)
bodies = [
    {"seq": 0, "role": "reporter", "text": "Meldung"},
    {"seq": 1, "role": "handler", "text": "Danke, wir prüfen das."},
    {"seq": 2, "role": "reporter", "text": "Noch ein Detail."},
]

prev = None
for i, body in enumerate(bodies):
    if prev is not None:
        body["prev"] = prev
    plaintext = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()
    nonce = fixed(f"chain nonce {i}", 24)
    ciphertext = VERSION + nonce + secretbox(plaintext, nonce, case_key)
    prev = message_hash(ciphertext)
    print(f"  {{ ciphertext: '{ciphertext.hex()}', hash: '{prev}' }},")
print(f"caseKey: '{case_key.hex()}'")
