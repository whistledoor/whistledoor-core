import { CrockfordError, decodeCrockford, encodeCrockford } from './crockford.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 2.

/** A case code is 100 random bits, stored in 13 bytes with the last 4 bits zero. */
export const CASE_CODE_BYTES = 13;

const CASE_CODE_CHARS = 20;
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
  return encodeCrockford(code, CASE_CODE_CHARS);
}

/**
 * Reads a case code typed by a reporter. Ignores case, whitespace and dashes,
 * and reads `I`/`L` as `1` and `O` as `0`.
 */
export function parseCaseCode(input: string): Uint8Array {
  try {
    return decodeCrockford(input, CASE_CODE_CHARS, CASE_CODE_BYTES);
  } catch (error) {
    if (error instanceof CrockfordError) {
      throw new CaseCodeError(error.reason, error.message);
    }
    throw error;
  }
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
