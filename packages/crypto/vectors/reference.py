"""Minimal reference implementations used only to generate test vectors.

Written from the specs (RFC 7748, Salsa20/XSalsa20, RFC 8439 Poly1305, libsodium
sealed-box construction) so vectors do not come from libsodium itself. Slow and
not constant-time; never use outside test-vector generation.
"""
import hashlib

M32 = 0xFFFFFFFF
P25519 = 2**255 - 19


def x25519(k: bytes, u: bytes) -> bytes:
    k = bytearray(k)
    k[0] &= 248
    k[31] &= 127
    k[31] |= 64
    scalar = int.from_bytes(k, "little")
    x1 = int.from_bytes(u, "little") & ((1 << 255) - 1)
    x2, z2, x3, z3, swap = 1, 0, x1, 1, 0
    for t in reversed(range(255)):
        bit = (scalar >> t) & 1
        swap ^= bit
        if swap:
            x2, x3, z2, z3 = x3, x2, z3, z2
        swap = bit
        a, b, c, d = x2 + z2, x2 - z2, x3 + z3, x3 - z3
        aa, bb = a * a, b * b
        e = aa - bb
        da, cb = d * a, c * b
        x3 = (da + cb) ** 2 % P25519
        z3 = x1 * (da - cb) ** 2 % P25519
        x2 = aa * bb % P25519
        z2 = e * (aa + 121665 * e) % P25519
    if swap:
        x2, z2 = x3, z3
    return (x2 * pow(z2, P25519 - 2, P25519) % P25519).to_bytes(32, "little")


def x25519_base(k: bytes) -> bytes:
    return x25519(k, (9).to_bytes(32, "little"))


def _rotl(x: int, n: int) -> int:
    return ((x << n) | (x >> (32 - n))) & M32


def _salsa20_rounds(state: list[int]) -> list[int]:
    x = list(state)

    def qr(a: int, b: int, c: int, d: int) -> None:
        x[b] ^= _rotl((x[a] + x[d]) & M32, 7)
        x[c] ^= _rotl((x[b] + x[a]) & M32, 9)
        x[d] ^= _rotl((x[c] + x[b]) & M32, 13)
        x[a] ^= _rotl((x[d] + x[c]) & M32, 18)

    for _ in range(10):
        qr(0, 4, 8, 12); qr(5, 9, 13, 1); qr(10, 14, 2, 6); qr(15, 3, 7, 11)
        qr(0, 1, 2, 3); qr(5, 6, 7, 4); qr(10, 11, 8, 9); qr(15, 12, 13, 14)
    return x


def _words(b: bytes) -> list[int]:
    return [int.from_bytes(b[i:i + 4], "little") for i in range(0, len(b), 4)]


def _state(key: bytes, input16: bytes) -> list[int]:
    sigma = _words(b"expand 32-byte k")
    k, n = _words(key), _words(input16)
    return [sigma[0], *k[0:4], sigma[1], *n, sigma[2], *k[4:8], sigma[3]]


def hsalsa20(key: bytes, nonce16: bytes) -> bytes:
    x = _salsa20_rounds(_state(key, nonce16))
    return b"".join(x[i].to_bytes(4, "little") for i in (0, 5, 10, 15, 6, 7, 8, 9))


def xsalsa20_stream(key: bytes, nonce24: bytes, length: int) -> bytes:
    subkey = hsalsa20(key, nonce24[:16])
    out = b""
    counter = 0
    while len(out) < length:
        s = _state(subkey, nonce24[16:24] + counter.to_bytes(8, "little"))
        x = _salsa20_rounds(s)
        out += b"".join(((x[i] + s[i]) & M32).to_bytes(4, "little") for i in range(16))
        counter += 1
    return out[:length]


def poly1305(key: bytes, msg: bytes) -> bytes:
    r = int.from_bytes(key[:16], "little") & 0x0FFFFFFC0FFFFFFC0FFFFFFC0FFFFFFF
    s = int.from_bytes(key[16:], "little")
    p, acc = (1 << 130) - 5, 0
    for i in range(0, len(msg), 16):
        acc = (acc + int.from_bytes(msg[i:i + 16] + b"\x01", "little")) * r % p
    return ((acc + s) % (1 << 128)).to_bytes(16, "little")


def secretbox(msg: bytes, nonce: bytes, key: bytes) -> bytes:
    """crypto_secretbox_easy: tag(16) || ciphertext."""
    stream = xsalsa20_stream(key, nonce, 32 + len(msg))
    c = bytes(a ^ b for a, b in zip(msg, stream[32:]))
    return poly1305(stream[:32], c) + c


def box_seal(msg: bytes, recipient_pk: bytes, ephemeral_sk: bytes) -> bytes:
    """crypto_box_seal with a fixed ephemeral key: epk || crypto_box(msg)."""
    epk = x25519_base(ephemeral_sk)
    nonce = hashlib.blake2b(epk + recipient_pk, digest_size=24).digest()
    shared = hsalsa20(x25519(ephemeral_sk, recipient_pk), bytes(16))
    return epk + secretbox(msg, nonce, shared)


def _self_test() -> None:
    # RFC 7748 section 5.2, first vector.
    assert x25519(
        bytes.fromhex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4"),
        bytes.fromhex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c"),
    ).hex() == "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552"
    # RFC 7748 section 6.1, Alice's public key.
    assert x25519_base(
        bytes.fromhex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a")
    ).hex() == "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
    # RFC 8439 section 2.5.2.
    assert poly1305(
        bytes.fromhex("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b"),
        b"Cryptographic Forum Research Group",
    ).hex() == "a8061dc1305136c6c22b8baf0c0127a9"


_self_test()
