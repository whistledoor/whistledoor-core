"""Test vectors for the case-code check character (crypto-design.md section 2).

check = sum over i = 1..20 of alpha^i * c_i in GF(2^5), polynomial
x^5 + x^2 + 1, alpha = x. Written separately from src/case-code.ts.

Run: python3 -I packages/crypto/vectors/case_code.py
"""
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
POLY = 0b100101  # x^5 + x^2 + 1


def gf_mul(a: int, b: int) -> int:
    """Carry-less multiply, then reduce modulo POLY."""
    product = 0
    for bit in range(5):
        if b >> bit & 1:
            product ^= a << bit
    for bit in range(8, 4, -1):
        if product >> bit & 1:
            product ^= POLY << (bit - 5)
    return product


def gf_pow(a: int, n: int) -> int:
    result = 1
    for _ in range(n):
        result = gf_mul(result, a)
    return result


def check_char(code20: str) -> str:
    total = 0
    for i, char in enumerate(code20, start=1):
        total ^= gf_mul(gf_pow(2, i), ALPHABET.index(char))
    return ALPHABET[total]


def encode(code_bytes: bytes) -> str:
    bits = "".join(f"{b:08b}" for b in code_bytes)[:100]
    return "".join(ALPHABET[int(bits[i:i + 5], 2)] for i in range(0, 100, 5))


def self_test() -> None:
    # alpha generates all 31 non-zero elements: POLY is primitive.
    assert len({gf_pow(2, n) for n in range(31)}) == 31
    # Every non-zero element has an inverse, so the field is valid.
    for a in range(1, 32):
        assert any(gf_mul(a, b) == 1 for b in range(1, 32))
    # Every single substitution and every adjacent swap changes the check.
    for code in ("041061050R3GG28A1C6D", "ZZZZZZZZZZZZZZZZZZZZ", "0123456789ABCDEFGHJK"):
        good = check_char(code)
        for i in range(20):
            for other in ALPHABET:
                if other != code[i]:
                    assert check_char(code[:i] + other + code[i + 1:]) != good
        for i in range(19):
            if code[i] != code[i + 1]:
                swapped = code[:i] + code[i + 1] + code[i] + code[i + 2:]
                assert check_char(swapped) != good


self_test()

for name, hex_bytes in [
    ("all zero", "00000000000000000000000000"),
    ("all one", "fffffffffffffffffffffffff0"),
    ("counting", "0102030405060708090a0b0cd0"),
    ("mixed", "0110c8531d0952d8d73e1194e0"),
]:
    code20 = encode(bytes.fromhex(hex_bytes))
    grouped = "-".join(code20[i:i + 4] for i in range(0, 20, 4)) + check_char(code20)
    print(f"{name:9} {hex_bytes} {grouped}")
