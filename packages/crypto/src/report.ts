import { DecryptionError } from './errors.js';
import { KEY_BYTES, assertLength, readVersioned, versioned } from './format.js';
import type { CaseKeys } from './case-code.js';
import type { KeyPair } from './keys.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 5.

export interface SealedReport {
  /** Identifies the case on the server. */
  lookupId: Uint8Array;
  /** `0x01 || crypto_box_seal(caseKey, tenantPk)`: lets handlers recover caseKey. */
  envelope: Uint8Array;
  /** The report as message 0, under caseKey. Read by handlers and by the reporter. */
  report: Uint8Array;
}

/** Seals the case key to the tenant: `0x01 || crypto_box_seal(caseKey, tenantPk)`. */
export async function sealEnvelope(caseKey: Uint8Array, tenantPk: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('caseKey', caseKey, KEY_BYTES);
  assertLength('tenantPk', tenantPk, KEY_BYTES);
  return versioned(sodium.crypto_box_seal(caseKey, tenantPk));
}

/** Opens an envelope with the tenant key pair. Throws DecryptionError if it is not for this tenant. */
export async function openEnvelope(envelope: Uint8Array, tenant: KeyPair): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('tenant publicKey', tenant.publicKey, KEY_BYTES);
  assertLength('tenant secretKey', tenant.secretKey, KEY_BYTES);
  const body = readVersioned(envelope, sodium.crypto_box_SEALBYTES + KEY_BYTES);
  try {
    return sodium.crypto_box_seal_open(body, tenant.publicKey, tenant.secretKey);
  } catch {
    throw new DecryptionError('Cannot open the envelope with this tenant key pair');
  }
}

/**
 * Encrypts a report or follow-up message under caseKey:
 * `0x01 || nonce || crypto_secretbox_easy`. `nonce` is for test vectors only.
 */
export async function encryptMessage(
  plaintext: Uint8Array,
  caseKey: Uint8Array,
  nonce?: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('caseKey', caseKey, KEY_BYTES);
  const n = nonce ? Uint8Array.from(nonce) : sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  assertLength('nonce', n, sodium.crypto_secretbox_NONCEBYTES);
  return versioned(n, sodium.crypto_secretbox_easy(plaintext, n, caseKey));
}

/** Decrypts a report or message. Throws DecryptionError for a wrong caseKey or changed data. */
export async function decryptMessage(ciphertext: Uint8Array, caseKey: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('caseKey', caseKey, KEY_BYTES);
  const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;
  const body = readVersioned(ciphertext);
  if (body.length < nonceBytes + sodium.crypto_secretbox_MACBYTES) {
    throw new DecryptionError('Message is too short');
  }
  try {
    return sodium.crypto_secretbox_open_easy(body.subarray(nonceBytes), body.subarray(0, nonceBytes), caseKey);
  } catch {
    throw new DecryptionError('Cannot decrypt the message: wrong case key or changed data');
  }
}

/** What the reporter's browser sends on submit: lookupId, envelope and report. */
export async function sealReport(
  reportPlaintext: Uint8Array,
  caseKeys: CaseKeys,
  tenantPk: Uint8Array,
): Promise<SealedReport> {
  return {
    lookupId: Uint8Array.from(caseKeys.lookupId),
    envelope: await sealEnvelope(caseKeys.caseKey, tenantPk),
    report: await encryptMessage(reportPlaintext, caseKeys.caseKey),
  };
}
