import { describe, expect, it } from 'vitest';
import { FINGERPRINT_VECTORS } from '../vectors/fingerprint.generated.js';
import {
  FINGERPRINT_BYTES,
  FingerprintError,
  computeFingerprint,
  fingerprintLastGroupMatches,
  fingerprintMatches,
  formatFingerprint,
  parseFingerprint,
} from './fingerprint.js';
import { getSodium } from './sodium.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALL_ZERO = FINGERPRINT_VECTORS[0];
const TENANT = FINGERPRINT_VECTORS[3];

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe.each(FINGERPRINT_VECTORS)('vector: $name', (vector) => {
  it('computes the fingerprint', async () => {
    expect(toHex(await computeFingerprint(fromHex(vector.publicKey)))).toBe(vector.bytes);
  });

  it('formats and parses', () => {
    expect(formatFingerprint(fromHex(vector.bytes))).toBe(vector.formatted);
    expect(toHex(parseFingerprint(vector.formatted))).toBe(vector.bytes);
  });

  it('matches its formatted form', () => {
    expect(fingerprintMatches(fromHex(vector.bytes), vector.formatted)).toBe(true);
  });
});

describe('computeFingerprint', () => {
  it('uses crypto_generichash with 13 bytes of output, not a shortened longer hash', async () => {
    const sodium = await getSodium();
    for (const vector of FINGERPRINT_VECTORS) {
      expect(toHex(sodium.crypto_generichash(13, fromHex(vector.publicKey), null))).toBe(vector.hash);
    }
  });

  it('clears the last 4 bits', async () => {
    // Without a hash that has these bits set, this test would prove nothing.
    expect(FINGERPRINT_VECTORS.some((vector) => (fromHex(vector.hash)[FINGERPRINT_BYTES - 1]! & 0x0f) !== 0)).toBe(true);
    for (const vector of FINGERPRINT_VECTORS) {
      expect(vector.bytes.slice(0, -1)).toBe(vector.hash.slice(0, -1));
      expect((await computeFingerprint(fromHex(vector.publicKey)))[FINGERPRINT_BYTES - 1]! & 0x0f).toBe(0);
    }
  });

  it('does not change the public key', async () => {
    const publicKey = fromHex(TENANT.publicKey);
    await computeFingerprint(publicKey);
    expect(toHex(publicKey)).toBe(TENANT.publicKey);
  });

  it.each([0, 31, 33])('rejects a public key of %i bytes', async (length) => {
    await expect(computeFingerprint(new Uint8Array(length))).rejects.toThrow(RangeError);
  });
});

describe('formatFingerprint', () => {
  it.each([new Uint8Array(12), new Uint8Array(14), fromHex('00000000000000000000000001')])(
    'rejects invalid bytes',
    (bytes) => {
      expect(() => formatFingerprint(bytes)).toThrow(FingerprintError);
    },
  );

  it('has no check character: 20 characters in 5 groups of 4', () => {
    for (const vector of FINGERPRINT_VECTORS) {
      expect(vector.formatted).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    }
  });
});

describe('parseFingerprint', () => {
  it('ignores case, whitespace and dashes', () => {
    expect(toHex(parseFingerprint(' 4cd0 xc75-qsaz\t52q8--s458\n'))).toBe(TENANT.bytes);
    expect(toHex(parseFingerprint('4CD0XC75QSAZ52Q8S458'))).toBe(TENANT.bytes);
  });

  it('reads I and L as 1 and O as 0', () => {
    expect(toHex(parseFingerprint('4CDO-XC75-QSAZ-52Q8-S458'))).toBe(TENANT.bytes);
    expect(toHex(parseFingerprint('HI5D-HXJT-VHJY-ZX2M-X3PR'))).toBe(ALL_ZERO.bytes);
    expect(toHex(parseFingerprint('Hl5D-HXJT-VHJY-ZX2M-X3PR'))).toBe(ALL_ZERO.bytes);
  });

  it.each(['', '4CD0', '4CD0-XC75-QSAZ-52Q8-S45', '4CD0-XC75-QSAZ-52Q8-S458X'])(
    'rejects wrong length: "%s"',
    (input) => {
      expect(() => parseFingerprint(input)).toThrow(expect.objectContaining({ reason: 'length' }));
    },
  );

  it.each(['U', '*', 'Ä'])('rejects character "%s"', (char) => {
    expect(() => parseFingerprint(`4CD0-XC75-QSAZ-52Q8-S45${char}`)).toThrow(
      expect.objectContaining({ reason: 'character' }),
    );
    expect(() => parseFingerprint(`4CD0-XC75-QSAZ-52Q8-S45${char}`)).toThrow(FingerprintError);
  });
});

describe('fingerprintLastGroupMatches', () => {
  const fingerprint = fromHex(TENANT.bytes);
  const lastGroup = TENANT.formatted.slice(-4);

  it('accepts the last group with the same tolerance as a fingerprint', () => {
    expect(fingerprintLastGroupMatches(fingerprint, lastGroup)).toBe(true);
    expect(fingerprintLastGroupMatches(fingerprint, ` ${lastGroup.toLowerCase()}\n`)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(fingerprintLastGroupMatches(fingerprint, '')).toBe(false);
    expect(fingerprintLastGroupMatches(fingerprint, lastGroup.slice(1))).toBe(false);
    expect(fingerprintLastGroupMatches(fingerprint, TENANT.formatted)).toBe(false);
    expect(fingerprintLastGroupMatches(fromHex(ALL_ZERO.bytes), lastGroup)).toBe(false);
  });

  it('rejects bytes that are not a fingerprint', () => {
    expect(() => fingerprintLastGroupMatches(new Uint8Array(12), lastGroup)).toThrow(FingerprintError);
  });
});

describe('fingerprintMatches', () => {
  const fingerprint = fromHex(TENANT.bytes);

  it('accepts sloppy input the way case codes do', () => {
    expect(fingerprintMatches(fingerprint, ' 4cdo xc75-qsaz\t52q8--s458\n')).toBe(true);
    expect(fingerprintMatches(fromHex(ALL_ZERO.bytes), 'hI5d hxjt vhjy zx2m x3pr')).toBe(true);
    expect(fingerprintMatches(fromHex(ALL_ZERO.bytes), 'hl5d-hxjt-vhjy-zx2m-x3pr')).toBe(true);
  });

  it('rejects another key', () => {
    expect(fingerprintMatches(fingerprint, ALL_ZERO.formatted)).toBe(false);
  });

  it('rejects every single wrong character', () => {
    const typed = TENANT.formatted.replace(/-/g, '');
    for (let i = 0; i < typed.length; i++) {
      for (const other of ALPHABET) {
        if (other !== typed[i]) {
          expect(fingerprintMatches(fingerprint, typed.slice(0, i) + other + typed.slice(i + 1))).toBe(false);
        }
      }
    }
  });

  it.each([
    ['empty', ''],
    ['the last group alone', 'S458'],
    ['one character short', '4CD0-XC75-QSAZ-52Q8-S45'],
    ['one character long, like a case code', '4CD0-XC75-QSAZ-52Q8-S4580'],
    ['an invalid character', '4CD0-XC75-QSAZ-52Q8-S45U'],
  ])('does not match %s', (_name, input) => {
    expect(fingerprintMatches(fingerprint, input)).toBe(false);
  });

  it.each([new Uint8Array(12), fromHex('00000000000000000000000001')])(
    'throws for invalid fingerprint bytes instead of reporting a mismatch',
    (bytes) => {
      expect(() => fingerprintMatches(bytes, TENANT.formatted)).toThrow(FingerprintError);
    },
  );
});
