import { getSodium } from './sodium.js';

// crypto-design.md section 3.

export const PASSWORD_SALT_BYTES = 16;

const KDF_CONTEXT = 'WDpass01';
const KDF_ID_AUTH_KEY = 1;
const KDF_ID_KEK = 2;
const DERIVED_BYTES = 32;

/** Argon2id cost, stored per handler on the server next to the salt. */
export interface PasswordHashParams {
  opsLimit: number;
  /** In bytes. */
  memLimit: number;
}

/**
 * The weakest params the client accepts. A constant, never fetched: a
 * compromised server must not be able to make offline guessing cheap.
 */
export const MIN_PASSWORD_HASH_PARAMS: Readonly<PasswordHashParams> = Object.freeze({
  opsLimit: 2,
  memLimit: 19 * 1024 * 1024,
});

/** Proposed in crypto-design.md section 3; final values are open item 6. */
export const DEFAULT_PASSWORD_HASH_PARAMS: Readonly<PasswordHashParams> = Object.freeze({
  opsLimit: 3,
  memLimit: 64 * 1024 * 1024,
});

/** Thrown when params are below MIN_PASSWORD_HASH_PARAMS or not integers. */
export class PasswordHashParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordHashParamsError';
  }
}

export interface PasswordKeys {
  /** Sent hex-encoded to better-auth as the login password; hashed again there. */
  authKey: Uint8Array;
  /** Unwraps the handler's private key; never leaves the browser. */
  kek: Uint8Array;
}

/**
 * Creates a new per-handler salt. `random` is for test vectors only;
 * production callers omit it and get `randombytes_buf(16)`.
 */
export async function generatePasswordSalt(random?: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const salt = random ? Uint8Array.from(random) : sodium.randombytes_buf(PASSWORD_SALT_BYTES);
  assertSalt(salt);
  return salt;
}

/**
 * Stretches the password with Argon2id and splits the result into authKey and
 * kek. The password is NFC-normalized first; throws PasswordHashParamsError
 * before any work if params are below the floor.
 */
export async function derivePasswordKeys(
  password: string,
  salt: Uint8Array,
  params: PasswordHashParams = DEFAULT_PASSWORD_HASH_PARAMS,
): Promise<PasswordKeys> {
  assertSalt(salt);
  assertParams(params);
  const sodium = await getSodium();
  const passwordBytes = new TextEncoder().encode(password.normalize('NFC'));
  let master: Uint8Array | undefined;
  try {
    master = sodium.crypto_pwhash(
      DERIVED_BYTES,
      passwordBytes,
      salt,
      params.opsLimit,
      params.memLimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
    return {
      authKey: sodium.crypto_kdf_derive_from_key(DERIVED_BYTES, KDF_ID_AUTH_KEY, KDF_CONTEXT, master),
      kek: sodium.crypto_kdf_derive_from_key(DERIVED_BYTES, KDF_ID_KEK, KDF_CONTEXT, master),
    };
  } finally {
    sodium.memzero(passwordBytes);
    if (master) {
      sodium.memzero(master);
    }
  }
}

/** The form in which authKey is sent to better-auth. */
export function encodeAuthKey(authKey: Uint8Array): string {
  return Array.from(authKey, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertParams(params: PasswordHashParams): void {
  // Number.isSafeInteger also rejects NaN, which would pass a plain `<` check.
  if (!Number.isSafeInteger(params.opsLimit) || !Number.isSafeInteger(params.memLimit)) {
    throw new PasswordHashParamsError('Argon2id params must be integers');
  }
  if (params.opsLimit < MIN_PASSWORD_HASH_PARAMS.opsLimit || params.memLimit < MIN_PASSWORD_HASH_PARAMS.memLimit) {
    throw new PasswordHashParamsError(
      `Argon2id params below the minimum (opsLimit ${params.opsLimit}, memLimit ${params.memLimit})`,
    );
  }
}

function assertSalt(salt: Uint8Array): void {
  if (salt.length !== PASSWORD_SALT_BYTES) {
    throw new RangeError(`Expected a ${PASSWORD_SALT_BYTES}-byte salt, got ${salt.length}`);
  }
}
