import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_HASH_PARAMS,
  derivePasswordKeys,
  encodeAuthKey,
  generatePasswordSalt,
} from './password.js';
import { getSodium } from './sodium.js';

// Vectors computed independently, without libsodium: master from OpenSSL 3.5
// `kdf ARGON2ID` (lanes 1, memcost = memLimit / 1024 KiB), subkeys from Python's
// hashlib.blake2b(key=master, salt=LE64(id) || 0^8, person="WDpass01" || 0^8).
const VECTORS = [
  {
    name: 'default params',
    password: 'correct horse battery staple',
    salt: '000102030405060708090a0b0c0d0e0f',
    params: DEFAULT_PASSWORD_HASH_PARAMS,
    authKey: '3ddbbd5b4a89071a0f86e61548a6a5c1429f6330253f1e28bcd7fd06c8b3fe7f',
    kek: '67e21794bc9aed6cdc75fa58c3e7e893c6ab5defa26584ad217394dfb9bba884',
  },
  {
    name: 'non-ASCII, UTF-8 encoded',
    password: 'Grüße, Wien! \u{1f511}',
    salt: 'ffffffffffffffffffffffffffffffff',
    params: { opsLimit: 2, memLimit: 8 * 1024 * 1024 },
    authKey: 'f3d008a03c5c97652c7d6f63de95fc005190ccb79ca0d6e700afb7faf2b54114',
    kek: 'f35813dbba355bff3a7da5d47e43b2d0f76bf90721331527ae47953a5cc4be37',
  },
  {
    name: 'one character',
    password: 'a',
    salt: 'a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5',
    params: { opsLimit: 1, memLimit: 1024 * 1024 },
    authKey: 'a9714a27c046f4be4e0bb43169fb215656ac4937555e25e2d15d9cbb76f31fe2',
    kek: '88342c358f73a01c3fbd6259b55714edd9ad0c3036f9bd961d9225264ad1ac44',
  },
] as const;

const FAST_PARAMS = VECTORS[2].params;

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

describe.each(VECTORS)('vector: $name', (vector) => {
  it('derives authKey and kek', async () => {
    const keys = await derivePasswordKeys(vector.password, fromHex(vector.salt), vector.params);
    expect(encodeAuthKey(keys.authKey)).toBe(vector.authKey);
    expect(encodeAuthKey(keys.kek)).toBe(vector.kek);
  });
});

describe('derivePasswordKeys', () => {
  it('uses the default params when none are given', async () => {
    const vector = VECTORS[0];
    const keys = await derivePasswordKeys(vector.password, fromHex(vector.salt));
    expect(encodeAuthKey(keys.kek)).toBe(vector.kek);
  });

  // kek is a sibling of authKey (both derived from master), not a child of it.
  // Guard against a refactor that chains the derivation through authKey.
  it('does not derive kek from authKey', async () => {
    const sodium = await getSodium();
    const vector = VECTORS[2];
    const { authKey, kek } = await derivePasswordKeys(vector.password, fromHex(vector.salt), vector.params);
    const fromAuthKey = [
      authKey,
      sodium.crypto_generichash(32, authKey, null),
      sodium.crypto_kdf_derive_from_key(32, 1, 'WDpass01', authKey),
      sodium.crypto_kdf_derive_from_key(32, 2, 'WDpass01', authKey),
    ];
    for (const candidate of fromAuthKey) {
      expect(sodium.memcmp(candidate, kek)).toBe(false);
    }
  });

  it('gives different keys for a different salt', async () => {
    const vector = VECTORS[2];
    const other = await derivePasswordKeys(vector.password, fromHex('5a'.repeat(16)), FAST_PARAMS);
    expect(encodeAuthKey(other.authKey)).not.toBe(vector.authKey);
    expect(encodeAuthKey(other.kek)).not.toBe(vector.kek);
  });

  it('rejects a salt of the wrong length', async () => {
    await expect(derivePasswordKeys('a', new Uint8Array(15), FAST_PARAMS)).rejects.toThrow(RangeError);
  });
});

describe('generatePasswordSalt', () => {
  it('copies the given randomness', async () => {
    const random = fromHex(VECTORS[0].salt);
    const salt = await generatePasswordSalt(random);
    expect(salt).toEqual(random);
    expect(salt).not.toBe(random);
  });

  it('uses randombytes_buf when no randomness is given', async () => {
    expect(await generatePasswordSalt()).toHaveLength(16);
  });

  it('rejects randomness of the wrong length', async () => {
    await expect(generatePasswordSalt(new Uint8Array(17))).rejects.toThrow(RangeError);
  });
});
