import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_HASH_PARAMS,
  MIN_PASSWORD_HASH_PARAMS,
  PasswordHashParamsError,
  derivePasswordKeys,
  encodeAuthKey,
  generatePasswordSalt,
} from './password.js';
import { getSodium } from './sodium.js';

// Vectors computed independently, without libsodium: password NFC-normalized
// with Python's unicodedata, master from OpenSSL 3.5 `kdf ARGON2ID` (lanes 1, memcost = memLimit / 1024 KiB), subkeys from Python's
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
    name: 'non-ASCII at the floor',
    // Escaped so the test file cannot silently change normalization form.
    password: 'Grüße, Wien! \u{1f511}',
    salt: 'ffffffffffffffffffffffffffffffff',
    params: MIN_PASSWORD_HASH_PARAMS,
    authKey: 'aedec1ffdc410c49e7573cf41f34e8bdbc2fabe74aaaa34bfbb4e3b5fc6f6c58',
    kek: 'ce17ca3ad7767376ff04855241fc8bd03596eeca89710712ca0108856216ff82',
  },
  {
    name: 'one character',
    password: 'a',
    salt: 'a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5',
    params: { opsLimit: 4, memLimit: 19 * 1024 * 1024 },
    authKey: '6bccd02537c4cbe201afbe5c0b7412bec7d8ba6fbad19c4e441e23bd71999100',
    kek: '0752bb86e8170f03303d40e90cd934ba315c9abf99ed4ba618e72de1c9324969',
  },
] as const;

const FAST_PARAMS = MIN_PASSWORD_HASH_PARAMS;

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

  it('normalizes the password to NFC', async () => {
    const vector = VECTORS[1];
    // Same text as the vector, but with u + combining diaeresis (NFD).
    const nfd = 'Grüße, Wien! \u{1f511}';
    expect(nfd).not.toBe(vector.password);
    const keys = await derivePasswordKeys(nfd, fromHex(vector.salt), vector.params);
    expect(encodeAuthKey(keys.kek)).toBe(vector.kek);
  });

  it.each([
    { opsLimit: 1, memLimit: 64 * 1024 * 1024 },
    { opsLimit: 3, memLimit: 19 * 1024 * 1024 - 1 },
    { opsLimit: 1, memLimit: 8192 },
    { opsLimit: Number.NaN, memLimit: 64 * 1024 * 1024 },
    { opsLimit: 3, memLimit: Number.NaN },
    { opsLimit: 2.5, memLimit: 64 * 1024 * 1024 },
  ])('rejects params below the floor or not integers: %o', async (params) => {
    await expect(derivePasswordKeys('a', fromHex(VECTORS[2].salt), params)).rejects.toThrow(PasswordHashParamsError);
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
