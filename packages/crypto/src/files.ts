import { CiphertextFormatError, DecryptionError } from './errors.js';
import { KEY_BYTES, assertLength, readVersioned, versioned } from './format.js';
import { getSodium } from './sodium.js';

// crypto-design.md section 6.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const CHUNK_BYTES = 64 * 1024;

export interface EncryptedFile {
  /** Goes into the report or message JSON, never to the server in clear. */
  fileKey: Uint8Array;
  /** secretstream header; goes into the JSON next to fileKey. */
  header: Uint8Array;
  /** Stored object: `0x01 || chunk || chunk || …`, the last chunk tagged FINAL. */
  ciphertext: Uint8Array;
}

/** Padmé: the size a file of `length` bytes is padded to before encryption. */
export function paddedLength(length: number): number {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError(`Invalid length ${length}`);
  }
  if (length < 2) {
    return length;
  }
  const e = Math.floor(Math.log2(length));
  const s = Math.floor(Math.log2(e)) + 1;
  const mask = 2 ** (e - s) - 1;
  // Plain arithmetic instead of bit operators, which are 32-bit in JavaScript.
  return Math.ceil(length / (mask + 1)) * (mask + 1);
}

/**
 * Pads the file (Padmé) and encrypts it with secretstream in 64 KiB chunks.
 * `fileKey` is for tests only; production callers omit it and get a random key.
 */
export async function encryptFile(data: Uint8Array, fileKey?: Uint8Array): Promise<EncryptedFile> {
  if (data.length > MAX_FILE_BYTES) {
    throw new RangeError(`File is larger than ${MAX_FILE_BYTES} bytes`);
  }
  const sodium = await getSodium();
  const key = fileKey ? Uint8Array.from(fileKey) : sodium.crypto_secretstream_xchacha20poly1305_keygen();
  assertLength('fileKey', key, KEY_BYTES);
  const padded = new Uint8Array(paddedLength(data.length));
  padded.set(data);
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const chunks: Uint8Array[] = [];
  let offset = 0;
  do {
    const end = Math.min(offset + CHUNK_BYTES, padded.length);
    const tag =
      end === padded.length
        ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
        : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    chunks.push(sodium.crypto_secretstream_xchacha20poly1305_push(state, padded.subarray(offset, end), null, tag));
    offset = end;
  } while (offset < padded.length);
  sodium.memzero(padded);
  return { fileKey: key, header, ciphertext: versioned(...chunks) };
}

/**
 * Decrypts a file and cuts off the padding. `size` is the true size from the
 * encrypted JSON. Throws DecryptionError if any chunk fails or the stream does
 * not end with exactly one FINAL chunk.
 */
export async function decryptFile(
  ciphertext: Uint8Array,
  fileKey: Uint8Array,
  header: Uint8Array,
  size: number,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  assertLength('fileKey', fileKey, KEY_BYTES);
  assertLength('header', header, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES);
  const padded = paddedLength(size);
  const aBytes = sodium.crypto_secretstream_xchacha20poly1305_ABYTES;
  const chunkCount = Math.max(1, Math.ceil(padded / CHUNK_BYTES));
  const body = readVersioned(ciphertext, padded + chunkCount * aBytes);
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, fileKey);
  const plain = new Uint8Array(padded);
  let offset = 0;
  for (let i = 0; i < chunkCount; i++) {
    const plainBytes = Math.min(CHUNK_BYTES, padded - i * CHUNK_BYTES);
    const chunk = body.subarray(offset, offset + plainBytes + aBytes);
    offset += chunk.length;
    let result: { message: Uint8Array; tag: number } | false;
    try {
      result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, chunk, null);
    } catch {
      result = false;
    }
    if (!result) {
      throw new DecryptionError(`Cannot decrypt file chunk ${i}: wrong key or changed data`);
    }
    const expectedTag =
      i === chunkCount - 1
        ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
        : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    if (result.tag !== expectedTag) {
      throw new DecryptionError(`File chunk ${i} has tag ${result.tag}, expected ${expectedTag}`);
    }
    plain.set(result.message, i * CHUNK_BYTES);
  }
  if (offset !== body.length) {
    throw new CiphertextFormatError('Data after the final chunk');
  }
  const data = plain.slice(0, size);
  sodium.memzero(plain);
  return data;
}
