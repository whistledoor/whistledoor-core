// Crockford Base32 for codes people read and type (crypto-design.md section 2):
// case codes, recovery keys and fingerprints.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP_SIZE = 4;

export type CrockfordErrorReason = 'length' | 'character';

/** Internal; callers rethrow it as their own error type. */
export class CrockfordError extends Error {
  readonly reason: CrockfordErrorReason;

  constructor(reason: CrockfordErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Encodes the first `chars * 5` bits of `bytes` as `XXXX-XXXX-…`. */
export function encodeCrockford(bytes: Uint8Array, chars: number): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  const groups: string[] = [];
  for (let i = 0; i < chars; i += GROUP_SIZE) {
    groups.push(out.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Decodes typed input of exactly `chars` characters into `byteLength` bytes.
 * Ignores case, whitespace and dashes; reads `I`/`L` as `1` and `O` as `0`.
 * Unused low bits of the last byte are zero.
 */
export function decodeCrockford(input: string, chars: number, byteLength: number): Uint8Array {
  const normalized = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (normalized.length !== chars) {
    throw new CrockfordError('length', `Expected ${chars} characters, got ${normalized.length}`);
  }
  const out = new Uint8Array(byteLength);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of normalized) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) {
      throw new CrockfordError('character', `Invalid character "${char}"`);
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) {
    out[index] = buffer << (8 - bits);
  }
  return out;
}
