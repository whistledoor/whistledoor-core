import { KEY_BYTES, assertLength } from './format.js';
import type { KeyPair } from './keys.js';
import { decryptMessage, encryptMessage, openEnvelope, sealEnvelope } from './report.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 5, internal notes. Same formats as the envelope and
// messages under another key: the reporter holds caseKey, so notes for handlers
// only use notesKey. Notes sit outside the message chain.

/**
 * Creates a case's notes key. `random` is for test vectors only; production
 * callers omit it and get `randombytes_buf(32)`.
 */
export async function generateNotesKey(random?: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const notesKey = random ? Uint8Array.from(random) : sodium.randombytes_buf(KEY_BYTES);
  assertLength('notesKey', notesKey, KEY_BYTES);
  return notesKey;
}

/** Seals the notes key to the tenant: `0x01 || crypto_box_seal(notesKey, tenantPk)`. */
export async function sealNotesEnvelope(notesKey: Uint8Array, tenantPk: Uint8Array): Promise<Uint8Array> {
  assertLength('notesKey', notesKey, KEY_BYTES);
  return sealEnvelope(notesKey, tenantPk);
}

/** Opens a notes envelope with the tenant key pair. Throws DecryptionError if it is not for this tenant. */
export async function openNotesEnvelope(notesEnvelope: Uint8Array, tenant: KeyPair): Promise<Uint8Array> {
  return openEnvelope(notesEnvelope, tenant);
}

/**
 * Encrypts a note under notesKey: `0x01 || nonce || crypto_secretbox_easy`.
 * `nonce` is for test vectors only.
 */
export async function encryptNote(
  plaintext: Uint8Array,
  notesKey: Uint8Array,
  nonce?: Uint8Array,
): Promise<Uint8Array> {
  assertLength('notesKey', notesKey, KEY_BYTES);
  return encryptMessage(plaintext, notesKey, nonce);
}

/** Decrypts a note. Throws DecryptionError for a wrong notesKey or changed data. */
export async function decryptNote(note: Uint8Array, notesKey: Uint8Array): Promise<Uint8Array> {
  assertLength('notesKey', notesKey, KEY_BYTES);
  return decryptMessage(note, notesKey);
}
