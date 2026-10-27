import { describe, expect, it } from 'vitest';
import {
  CaseCodeError,
  deriveCaseKeys,
  formatCaseCode,
  generateCaseCode,
  parseCaseCode,
} from './case-code.js';
import { getSodium } from './sodium.js';

// Vectors computed independently with Python's hashlib.blake2b (no libsodium):
// seed = blake2b(code, 32), subkey = blake2b("", 32, key=seed,
// salt=LE64(id) || 0^8, person="WDcase01" || 0^8). Check characters from
// vectors/case_code.py, a separate GF(2^5) implementation.
const VECTORS = [
  {
    name: 'all zero',
    bytes: '00000000000000000000000000',
    code: '0000-0000-0000-0000-00000',
    lookupId: '99bfb8f3e514b6dad1458f685803242b94d71a2fd187cb09baa63651b120d923',
    caseKey: '77e1ee4db4c4082a3515a2e883751034725be4f8bff302afcfc9307e78734c9d',
  },
  {
    name: 'all one',
    bytes: 'fffffffffffffffffffffffff0',
    code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZA',
    lookupId: '612c7cb429c9abdf508acbb11b91299bb595d7d6133e89e4992c1032ff88a99d',
    caseKey: '5ae9f3b03011201d320551339b63ab714c11ca2e8f47a81ed0e416c80f9a91e6',
  },
  {
    name: 'counting',
    bytes: '0102030405060708090a0b0cd0',
    code: '0410-6105-0R3G-G28A-1C6DW',
    lookupId: '4ed81cb747f73ab983ee0f2d9eca1ee2e48a23b21cf5cb2e7d9f8d79b51eca5f',
    caseKey: 'd12d37106bd1ba4866ac7d7de3b79e7643f1e63145c3489adbf1c9b5dafaf7ce',
  },
] as const;

// Check character only; derivation is covered by VECTORS.
const CHECK_VECTORS = [{ bytes: '0110c8531d0952d8d73e1194e0', code: '048C-GMRX-159D-HNSY-26AEA' }] as const;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe.each(VECTORS)('vector: $name', (vector) => {
  it('formats', () => {
    expect(formatCaseCode(fromHex(vector.bytes))).toBe(vector.code);
  });

  it('parses', () => {
    expect(toHex(parseCaseCode(vector.code))).toBe(vector.bytes);
  });

  it('derives lookupId and caseKey', async () => {
    const keys = await deriveCaseKeys(fromHex(vector.bytes));
    expect(toHex(keys.lookupId)).toBe(vector.lookupId);
    expect(toHex(keys.caseKey)).toBe(vector.caseKey);
  });
});

describe.each(CHECK_VECTORS)('check vector $code', (vector) => {
  it('formats and parses', () => {
    expect(formatCaseCode(fromHex(vector.bytes))).toBe(vector.code);
    expect(toHex(parseCaseCode(vector.code))).toBe(vector.bytes);
  });
});

describe('check character', () => {
  const codes = [...VECTORS, ...CHECK_VECTORS].map((vector) => vector.code.replace(/-/g, ''));

  it('catches every single wrong character', () => {
    for (const code of codes) {
      for (let i = 0; i < code.length; i++) {
        for (const other of ALPHABET) {
          if (other !== code[i]) {
            const typo = code.slice(0, i) + other + code.slice(i + 1);
            expect(() => parseCaseCode(typo)).toThrow(expect.objectContaining({ reason: 'check' }));
          }
        }
      }
    }
  });

  it('catches every swap of two adjacent different characters', () => {
    for (const code of codes) {
      for (let i = 0; i + 1 < code.length; i++) {
        if (code[i] !== code[i + 1]) {
          const swapped = code.slice(0, i) + code[i + 1]! + code[i]! + code.slice(i + 2);
          expect(() => parseCaseCode(swapped)).toThrow(expect.objectContaining({ reason: 'check' }));
        }
      }
    }
  });

  it('is read like the other characters: lower case, I, L and O', () => {
    expect(parseCaseCode('0410-6105-0R3G-G28A-1C6Dw')).toEqual(parseCaseCode('0410-6105-0R3G-G28A-1C6DW'));
    // All-zero code: its check character 0 typed as a lower-case o.
    expect(parseCaseCode('0000-0000-0000-0000-0000o')).toEqual(new Uint8Array(13));
  });

  it('rejects a 20-character code without check character', () => {
    expect(() => parseCaseCode('0410-6105-0R3G-G28A-1C6D')).toThrow(expect.objectContaining({ reason: 'length' }));
  });

  it('is a CaseCodeError', () => {
    expect(() => parseCaseCode('0410-6105-0R3G-G28A-1C6DX')).toThrow(CaseCodeError);
  });
});

describe('generateCaseCode', () => {
  it('clears the last 4 bits of the given randomness', async () => {
    const random = fromHex('0102030405060708090a0b0cdf');
    const code = await generateCaseCode(random);
    expect(toHex(code)).toBe('0102030405060708090a0b0cd0');
    expect(toHex(random)).toBe('0102030405060708090a0b0cdf');
  });

  it('uses randombytes_buf when no randomness is given', async () => {
    const code = await generateCaseCode();
    expect(code).toHaveLength(13);
    expect(code[12]! & 0x0f).toBe(0);
    expect(parseCaseCode(formatCaseCode(code))).toEqual(code);
  });

  it('rejects randomness of the wrong length', async () => {
    await expect(generateCaseCode(new Uint8Array(12))).rejects.toThrow(CaseCodeError);
  });
});

describe('parseCaseCode', () => {
  it('ignores case, whitespace and dashes', () => {
    expect(toHex(parseCaseCode(' 0410 6105-0r3g\tg28a--1c6dw\n'))).toBe('0102030405060708090a0b0cd0');
  });

  it('reads I and L as 1 and O as 0', () => {
    expect(parseCaseCode('o4Io-6Io5-OR3G-G28A-lC6DW')).toEqual(parseCaseCode('0410-6105-0R3G-G28A-1C6DW'));
  });

  it.each(['0410-6105-0R3G-G28A-1C6D', '0410-6105-0R3G-G28A-1C6DWX', ''])('rejects wrong length: "%s"', (input) => {
    expect(() => parseCaseCode(input)).toThrow(expect.objectContaining({ reason: 'length' }));
  });

  it.each(['U', '*', 'Ä'])('rejects character "%s", also as the check character', (char) => {
    for (const input of [`0410-6105-0R3G-G28A-1C6${char}W`, `0410-6105-0R3G-G28A-1C6D${char}`]) {
      expect(() => parseCaseCode(input)).toThrow(expect.objectContaining({ reason: 'character' }));
    }
  });
});

describe('formatCaseCode and deriveCaseKeys', () => {
  it.each([new Uint8Array(12), fromHex('00000000000000000000000001')])('reject invalid bytes', async (bytes) => {
    expect(() => formatCaseCode(bytes)).toThrow(CaseCodeError);
    await expect(deriveCaseKeys(bytes)).rejects.toThrow(CaseCodeError);
  });

  it('derive two different keys', async () => {
    const sodium = await getSodium();
    const keys = await deriveCaseKeys(fromHex(VECTORS[2].bytes));
    expect(sodium.memcmp(keys.lookupId, keys.caseKey)).toBe(false);
  });
});
