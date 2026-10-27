import { CrockfordError, decodeCrockford, encodeCrockford } from './crockford.js';
import { assertLength } from './format.js';
import type { KeyPair } from './keys.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 4, recovery key. The recovery key pair acts as one
// more handler: grant with grantTenantKey(tenantSk, recoveryPk), unlock with
// openTenantGrant, hand over with regrantTenantKey.

/** 160 random bits. */
export const RECOVERY_KEY_BYTES = 20;

const RECOVERY_KEY_CHARS = 32;
const KDF_CONTEXT = 'WDrcvr01';
const KDF_ID_SEED = 1;
const DERIVED_BYTES = 32;

export type RecoveryKeyErrorReason = 'length' | 'character';

/** Thrown when typed input is not a valid recovery key. */
export class RecoveryKeyError extends Error {
  readonly reason: RecoveryKeyErrorReason;

  constructor(reason: RecoveryKeyErrorReason, message: string) {
    super(message);
    this.name = 'RecoveryKeyError';
    this.reason = reason;
  }
}

/**
 * Creates a new recovery key. `random` is for test vectors only; production
 * callers omit it and get `randombytes_buf(20)`.
 */
export async function generateRecoveryKey(random?: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const key = random ? Uint8Array.from(random) : sodium.randombytes_buf(RECOVERY_KEY_BYTES);
  assertLength('recovery key', key, RECOVERY_KEY_BYTES);
  return key;
}

/** Renders a recovery key as 8 groups of 4: `XXXX-XXXX-…-XXXX`. */
export function formatRecoveryKey(recoveryKey: Uint8Array): string {
  assertLength('recovery key', recoveryKey, RECOVERY_KEY_BYTES);
  return encodeCrockford(recoveryKey, RECOVERY_KEY_CHARS);
}

/** Reads a typed recovery key with the same tolerance as case codes. */
export function parseRecoveryKey(input: string): Uint8Array {
  try {
    return decodeCrockford(input, RECOVERY_KEY_CHARS, RECOVERY_KEY_BYTES);
  } catch (error) {
    if (error instanceof CrockfordError) {
      throw new RecoveryKeyError(error.reason, error.message);
    }
    throw error;
  }
}

/** Derives the recovery key pair. The intermediate hash and seed are wiped. */
export async function deriveRecoveryKeyPair(recoveryKey: Uint8Array): Promise<KeyPair> {
  assertLength('recovery key', recoveryKey, RECOVERY_KEY_BYTES);
  const sodium = await getSodium();
  const hash = sodium.crypto_generichash(DERIVED_BYTES, recoveryKey, null);
  let seed: Uint8Array | undefined;
  try {
    seed = sodium.crypto_kdf_derive_from_key(DERIVED_BYTES, KDF_ID_SEED, KDF_CONTEXT, hash);
    const { publicKey, privateKey } = sodium.crypto_box_seed_keypair(seed);
    return { publicKey, secretKey: privateKey };
  } finally {
    sodium.memzero(hash);
    if (seed) {
      sodium.memzero(seed);
    }
  }
}
