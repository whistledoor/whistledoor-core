import { DecryptionError } from './errors.js';
import { KEY_BYTES, assertLength, readVersioned, versioned } from './format.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 4.

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Creates an X25519 key pair with `crypto_box_keypair`, for a handler or a tenant. */
export async function generateKeyPair(): Promise<KeyPair> {
  const sodium = await getSodium();
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  return { publicKey, secretKey: privateKey };
}

/**
 * Wraps a handler's secret key under kek: `0x01 || nonce || secretbox`.
 * `nonce` is for test vectors only; production callers omit it.
 */
export async function wrapHandlerSecretKey(
  handlerSk: Uint8Array,
  kek: Uint8Array,
  nonce?: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('handlerSk', handlerSk, KEY_BYTES);
  assertLength('kek', kek, KEY_BYTES);
  const n = nonce ? Uint8Array.from(nonce) : sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  assertLength('nonce', n, sodium.crypto_secretbox_NONCEBYTES);
  return versioned(n, sodium.crypto_secretbox_easy(handlerSk, n, kek));
}

/** Opens a wrapped handler secret key. Throws DecryptionError for a wrong kek. */
export async function unwrapHandlerSecretKey(wrapped: Uint8Array, kek: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('kek', kek, KEY_BYTES);
  const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;
  const body = readVersioned(wrapped, nonceBytes + sodium.crypto_secretbox_MACBYTES + KEY_BYTES);
  try {
    return sodium.crypto_secretbox_open_easy(body.subarray(nonceBytes), body.subarray(0, nonceBytes), kek);
  } catch {
    throw new DecryptionError('Cannot unwrap the handler key: wrong password or changed data');
  }
}

/** Seals the tenant secret key to one handler: `0x01 || crypto_box_seal`. */
export async function grantTenantKey(tenantSk: Uint8Array, handlerPk: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('tenantSk', tenantSk, KEY_BYTES);
  assertLength('handlerPk', handlerPk, KEY_BYTES);
  return versioned(sodium.crypto_box_seal(tenantSk, handlerPk));
}

/** Opens a grant with the handler's key pair. Throws DecryptionError if it is not theirs. */
export async function openTenantGrant(grant: Uint8Array, handler: KeyPair): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('handler publicKey', handler.publicKey, KEY_BYTES);
  assertLength('handler secretKey', handler.secretKey, KEY_BYTES);
  const body = readVersioned(grant, sodium.crypto_box_SEALBYTES + KEY_BYTES);
  try {
    return sodium.crypto_box_seal_open(body, handler.publicKey, handler.secretKey);
  } catch {
    throw new DecryptionError('Cannot open the tenant grant with this key pair');
  }
}

/**
 * Re-grant: an unlocked handler opens their own grant and seals the tenant key
 * to another handler's public key (new handler, or one who reset their password).
 */
export async function regrantTenantKey(
  ownGrant: Uint8Array,
  granter: KeyPair,
  newHandlerPk: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const tenantSk = await openTenantGrant(ownGrant, granter);
  try {
    return await grantTenantKey(tenantSk, newHandlerPk);
  } finally {
    sodium.memzero(tenantSk);
  }
}
