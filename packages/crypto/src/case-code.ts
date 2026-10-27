import {
  CROCKFORD_ALPHABET,
  CrockfordError,
  decodeCrockford,
  encodeCrockford,
  normalizeCrockford,
} from './crockford.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 2.

/** A case code is 100 random bits, stored in 13 bytes with the last 4 bits zero. */
export const CASE_CODE_BYTES = 13;

const CASE_CODE_CHARS = 20;
// GF(2^5) for the check character: x^5 + x^2 + 1, alpha = x.
const GF_POLYNOMIAL = 0b100101;
const GF_ALPHA = 2;
const KDF_CONTEXT = 'WDcase01';
const KDF_ID_LOOKUP = 1;
const KDF_ID_CASE_KEY = 2;
const DERIVED_BYTES = 32;

/**
 * `check`: the check character does not match, so the reporter most likely
 * mistyped a character. Nothing should be sent to the server.
 */
export type CaseCodeErrorReason = 'length' | 'character' | 'check';

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

/** Renders a case code as `XXXX-XXXX-XXXX-XXXX-XXXXC`, `C` being the check character. */
export function formatCaseCode(code: Uint8Array): string {
  assertCaseCodeBytes(code);
  return encodeCrockford(code, CASE_CODE_CHARS) + checkCharacter(code);
}

/**
 * Reads a case code typed by a reporter: 20 characters plus the check
 * character. Ignores case, whitespace and dashes, and reads `I`/`L` as `1`
 * and `O` as `0`. A wrong check character throws `CaseCodeError` with
 * reason `check`.
 */
export function parseCaseCode(input: string): Uint8Array {
  const normalized = normalizeCrockford(input);
  if (normalized.length !== CASE_CODE_CHARS + 1) {
    throw new CaseCodeError('length', `Expected ${CASE_CODE_CHARS + 1} characters, got ${normalized.length}`);
  }
  let code: Uint8Array;
  try {
    code = decodeCrockford(normalized.slice(0, CASE_CODE_CHARS), CASE_CODE_CHARS, CASE_CODE_BYTES);
  } catch (error) {
    if (error instanceof CrockfordError) {
      throw new CaseCodeError(error.reason, error.message);
    }
    throw error;
  }
  const check = normalized[CASE_CODE_CHARS]!;
  if (!CROCKFORD_ALPHABET.includes(check)) {
    throw new CaseCodeError('character', `Invalid character "${check}"`);
  }
  if (check !== checkCharacter(code)) {
    throw new CaseCodeError('check', 'The check character does not match; probably a typo');
  }
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

/** `sum over i = 1..20 of alpha^i * c_i` in GF(2^5), as one Crockford character. */
function checkCharacter(code: Uint8Array): string {
  let check = 0;
  let weight = 1;
  for (const char of encodeCrockford(code, CASE_CODE_CHARS).replace(/-/g, '')) {
    weight = gfMultiply(weight, GF_ALPHA);
    check ^= gfMultiply(weight, CROCKFORD_ALPHABET.indexOf(char));
  }
  return CROCKFORD_ALPHABET[check]!;
}

function gfMultiply(a: number, b: number): number {
  let product = 0;
  for (; b > 0; b >>= 1) {
    if (b & 1) {
      product ^= a;
    }
    a <<= 1;
    if (a & 0b100000) {
      a ^= GF_POLYNOMIAL;
    }
  }
  return product;
}

function assertCaseCodeBytes(code: Uint8Array): void {
  if (code.length !== CASE_CODE_BYTES) {
    throw new CaseCodeError('length', `Expected ${CASE_CODE_BYTES} bytes, got ${code.length}`);
  }
  if ((code[CASE_CODE_BYTES - 1]! & 0x0f) !== 0) {
    throw new CaseCodeError('length', 'The last 4 bits of a case code must be zero');
  }
}
