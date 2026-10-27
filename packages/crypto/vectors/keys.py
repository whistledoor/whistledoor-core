"""Test vectors for src/keys.ts (crypto-design.md section 4).

Run: python3 -I packages/crypto/vectors/keys.py
"""
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reference import box_seal, secretbox, x25519_base  # noqa: E402

VERSION = b"\x01"


def fixed(label: str, size: int) -> bytes:
    """Random-looking but reproducible bytes."""
    return hashlib.blake2b(label.encode(), digest_size=size).digest()


kek = fixed("kek", 32)
handler_a_sk = fixed("handler a sk", 32)
handler_b_sk = fixed("handler b sk", 32)
tenant_sk = fixed("tenant sk", 32)
wrap_nonce = fixed("wrap nonce", 24)

out = {
    "kek": kek,
    "handlerA.secretKey": handler_a_sk,
    "handlerA.publicKey": x25519_base(handler_a_sk),
    "handlerB.secretKey": handler_b_sk,
    "handlerB.publicKey": x25519_base(handler_b_sk),
    "tenant.secretKey": tenant_sk,
    "tenant.publicKey": x25519_base(tenant_sk),
    "wrapNonce": wrap_nonce,
    # version || nonce || crypto_secretbox_easy(handlerSk, nonce, kek)
    "wrappedHandlerA": VERSION + wrap_nonce + secretbox(handler_a_sk, wrap_nonce, kek),
    # version || crypto_box_seal(tenantSk, handlerPk), fixed ephemeral key
    "grantA": VERSION + box_seal(tenant_sk, x25519_base(handler_a_sk), fixed("grant a ephemeral", 32)),
    "grantB": VERSION + box_seal(tenant_sk, x25519_base(handler_b_sk), fixed("grant b ephemeral", 32)),
}
for name, value in out.items():
    print(f"{name}: '{value.hex()}'")
