import { getSodium } from './sodium.js';

// crypto-design.md section 2.

/** A case code is 100 random bits, stored in 13 bytes with the last 4 bits zero. */
export const CASE_CODE_BYTES = 13;

const CASE_CODE_CHARS = 20;
const GROUP_SIZE = 4;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KDF_CONTEXT = 'WDcase01';
const KDF_ID_LOOKUP = 1;
const KDF_ID_CASE_KEY = 2;
const DERIVED_BYTES = 32;

export type CaseCodeErrorReason = 'length' | 'character';

/** Thrown when user input or bytes are not a valid case code. */
export class CaseCodeError extends Error {
  readonly reason: CaseCodeErrorReason;

  constructor(reason: CaseCodeErrorReason, message: string) {
    super(message);
    this.name = 'CaseCodeError';
    this.reason = reason;
  }
}

export interface CaseKeys {
  /** Sent to the server to find the case. */
  lookupId: Uint8Array;
  /** Encrypts the case; never leaves the reporter's browser unsealed. */
  caseKey: Uint8Array;
}

/**
 * Creates a new case code. `random` is for test vectors only; production
 * callers omit it and get `randombytes_buf(13)`.
 */
export async function generateCaseCode(random?: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const code = random ? Uint8Array.from(random) : sodium.randombytes_buf(CASE_CODE_BYTES);
  if (code.length !== CASE_CODE_BYTES) {
    throw new CaseCodeError('length', `Expected ${CASE_CODE_BYTES} random bytes, got ${code.length}`);
  }
  code[CASE_CODE_BYTES - 1]! &= 0xf0;
  return code;
}

/** Renders a case code as `XXXX-XXXX-XXXX-XXXX-XXXX`. */
export function formatCaseCode(code: Uint8Array): string {
  assertCaseCodeBytes(code);
  let chars = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of code) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5 && chars.length < CASE_CODE_CHARS) {
      bits -= 5;
      chars += CROCKFORD[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  const groups: string[] = [];
  for (let i = 0; i < CASE_CODE_CHARS; i += GROUP_SIZE) {
    groups.push(chars.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Reads a case code typed by a reporter. Ignores case, whitespace and dashes,
 * and reads `I`/`L` as `1` and `O` as `0`.
 */
export function parseCaseCode(input: string): Uint8Array {
  const chars = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (chars.length !== CASE_CODE_CHARS) {
    throw new CaseCodeError('length', `Expected ${CASE_CODE_CHARS} characters, got ${chars.length}`);
  }
  const code = new Uint8Array(CASE_CODE_BYTES);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of chars) {
    const value = CROCKFORD.indexOf(char);
    if (value < 0) {
      throw new CaseCodeError('character', `Invalid character "${char}"`);
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      code[index++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  // 100 bits leave 4 in the buffer; they fill the high half of the last byte.
  code[index] = buffer << 4;
  return code;
}

/** Derives the lookup ID and case key from a case code. */
export async function deriveCaseKeys(code: Uint8Array): Promise<CaseKeys> {
  assertCaseCodeBytes(code);
  const sodium = await getSodium();
  const seed = sodium.crypto_generichash(DERIVED_BYTES, code, null);
  try {
    return {
      lookupId: sodium.crypto_kdf_derive_from_key(DERIVED_BYTES, KDF_ID_LOOKUP, KDF_CONTEXT, seed),
      caseKey: sodium.crypto_kdf_derive_from_key(DERIVED_BYTES, KDF_ID_CASE_KEY, KDF_CONTEXT, seed),
    };
  } finally {
    sodium.memzero(seed);
  }
}

function assertCaseCodeBytes(code: Uint8Array): void {
  if (code.length !== CASE_CODE_BYTES) {
    throw new CaseCodeError('length', `Expected ${CASE_CODE_BYTES} bytes, got ${code.length}`);
  }
  if ((code[CASE_CODE_BYTES - 1]! & 0x0f) !== 0) {
    throw new CaseCodeError('length', 'The last 4 bits of a case code must be zero');
  }
}
