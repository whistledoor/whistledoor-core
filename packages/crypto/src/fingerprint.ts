import { CrockfordError, decodeCrockford, encodeCrockford, normalizeCrockford } from './crockford.js';
import { KEY_BYTES, assertLength } from './format.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 4, fingerprints.

/** A fingerprint is 100 bits, stored in 13 bytes with the last 4 bits zero. */
export const FINGERPRINT_BYTES = 13;

const FINGERPRINT_CHARS = 20;
const LAST_GROUP_CHARS = 4;

export type FingerprintErrorReason = 'length' | 'character';

/** Thrown when user input or bytes are not a valid fingerprint. */
export class FingerprintError extends Error {
  readonly reason: FingerprintErrorReason;

  constructor(reason: FingerprintErrorReason, message: string) {
    super(message);
    this.name = 'FingerprintError';
    this.reason = reason;
  }
}

/** Computes `crypto_generichash(13, pk)` with the last 4 bits cleared. */
export async function computeFingerprint(publicKey: Uint8Array): Promise<Uint8Array> {
  assertLength('publicKey', publicKey, KEY_BYTES);
  const sodium = await getSodium();
  const fingerprint = sodium.crypto_generichash(FINGERPRINT_BYTES, publicKey, null);
  fingerprint[FINGERPRINT_BYTES - 1]! &= 0xf0;
  return fingerprint;
}

/** Renders a fingerprint as `XXXX-XXXX-XXXX-XXXX-XXXX`. It has no check character. */
export function formatFingerprint(fingerprint: Uint8Array): string {
  assertFingerprintBytes(fingerprint);
  return encodeCrockford(fingerprint, FINGERPRINT_CHARS);
}

/** Reads a typed or URL fingerprint with the same tolerance as case codes. */
export function parseFingerprint(input: string): Uint8Array {
  try {
    return decodeCrockford(input, FINGERPRINT_CHARS, FINGERPRINT_BYTES);
  } catch (error) {
    if (error instanceof CrockfordError) {
      throw new FingerprintError(error.reason, error.message);
    }
    throw error;
  }
}

/**
 * Compares a computed fingerprint with typed or URL input, read as
 * `parseFingerprint` reads it. Input that is not a fingerprint does not match.
 * The full 20 characters are required, so a short `#fp=` cannot weaken the
 * check. Fingerprints are public, so this need not run in constant time.
 */
export function fingerprintMatches(fingerprint: Uint8Array, input: string): boolean {
  assertFingerprintBytes(fingerprint);
  let parsed: Uint8Array;
  try {
    parsed = parseFingerprint(input);
  } catch (error) {
    if (error instanceof FingerprintError) {
      return false;
    }
    throw error;
  }
  return parsed.every((byte, index) => byte === fingerprint[index]);
}

/**
 * Compares the last group of a fingerprint with typed input, for the grant
 * step: the new handler reads their fingerprint aloud and the granting handler
 * types the last group. Only this exact group matches, read as
 * `parseFingerprint` reads it.
 */
export function fingerprintLastGroupMatches(fingerprint: Uint8Array, input: string): boolean {
  const lastGroup = formatFingerprint(fingerprint).replaceAll('-', '').slice(-LAST_GROUP_CHARS);
  return normalizeCrockford(input) === lastGroup;
}

function assertFingerprintBytes(fingerprint: Uint8Array): void {
  if (fingerprint.length !== FINGERPRINT_BYTES) {
    throw new FingerprintError('length', `Expected ${FINGERPRINT_BYTES} bytes, got ${fingerprint.length}`);
  }
  if ((fingerprint[FINGERPRINT_BYTES - 1]! & 0x0f) !== 0) {
    throw new FingerprintError('length', 'The last 4 bits of a fingerprint must be zero');
  }
}
