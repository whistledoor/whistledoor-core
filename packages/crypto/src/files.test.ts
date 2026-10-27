import { describe, expect, it } from 'vitest';
import { FILE_VECTORS as V } from '../vectors/report.generated.js';
import { CiphertextFormatError, DecryptionError } from './errors.js';
import { MAX_FILE_BYTES, decryptFile, encryptFile, paddedLength } from './files.js';

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// Plaintexts behind the vectors in vectors/report.py.
const PLAINTEXTS = {
  empty: new Uint8Array(0),
  allBytes: Uint8Array.from({ length: 256 }, (_, i) => i),
  twoChunks: Uint8Array.from({ length: 70000 }, (_, i) => (i * 7 + 3) % 256),
} as const;

const NAMES = ['empty', 'allBytes', 'twoChunks'] as const;

describe('paddedLength (Padmé)', () => {
  it('matches the reference values', () => {
    expect([0, 1, 2, 3, 100, 70000, MAX_FILE_BYTES].map(paddedLength)).toEqual([
      0, 1, 2, 3, 104, 71680, MAX_FILE_BYTES,
    ]);
  });

  it('never adds more than 12%', () => {
    for (let length = 2; length < 5_000_000; length = Math.ceil(length * 1.37) + 1) {
      const padded = paddedLength(length);
      expect(padded).toBeGreaterThanOrEqual(length);
      expect(padded / length).toBeLessThanOrEqual(1.12);
    }
  });

  it('rejects negative and non-integer lengths', () => {
    expect(() => paddedLength(-1)).toThrow(RangeError);
    expect(() => paddedLength(1.5)).toThrow(RangeError);
  });
});

describe.each(NAMES)('file vector: %s', (name) => {
  it('decrypts to the plaintext', async () => {
    const vector = V[name];
    const data = await decryptFile(fromBase64(vector.ciphertextBase64), fromHex(V.fileKey), fromHex(V.header), vector.size);
    expect(data).toEqual(PLAINTEXTS[name]);
  });

  it('round trips through encryptFile', async () => {
    const plain = PLAINTEXTS[name];
    const encrypted = await encryptFile(plain, fromHex(V.fileKey));
    const padded = paddedLength(plain.length);
    const chunks = Math.max(1, Math.ceil(padded / 65536));
    expect(encrypted.ciphertext).toHaveLength(1 + padded + chunks * 17);
    expect(await decryptFile(encrypted.ciphertext, encrypted.fileKey, encrypted.header, plain.length)).toEqual(plain);
  });
});

describe('decryptFile errors', () => {
  const twoChunks = (): Uint8Array => fromBase64(V.twoChunks.ciphertextBase64);
  const decrypt = (ciphertext: Uint8Array, size: number = V.twoChunks.size): Promise<Uint8Array> =>
    decryptFile(ciphertext, fromHex(V.fileKey), fromHex(V.header), size);

  it('rejects a wrong key and a changed chunk with DecryptionError', async () => {
    const wrongKey = fromHex(V.fileKey);
    wrongKey[0]! ^= 1;
    await expect(decryptFile(twoChunks(), wrongKey, fromHex(V.header), V.twoChunks.size)).rejects.toThrow(
      DecryptionError,
    );
    const changed = twoChunks();
    changed[changed.length - 20]! ^= 1;
    await expect(decrypt(changed)).rejects.toThrow(DecryptionError);
  });

  it('rejects truncation, extra data and an unknown version with CiphertextFormatError', async () => {
    const ciphertext = twoChunks();
    await expect(decrypt(ciphertext.subarray(0, 1 + 65536 + 17))).rejects.toThrow(CiphertextFormatError);
    await expect(decrypt(Uint8Array.from([...ciphertext, 0]))).rejects.toThrow(CiphertextFormatError);
    const otherVersion = Uint8Array.from(ciphertext);
    otherVersion[0] = 0x02;
    await expect(decrypt(otherVersion)).rejects.toThrow(CiphertextFormatError);
  });

  it('rejects a stream that stops before its FINAL chunk', async () => {
    // A size whose padded length fits the first chunk exactly: the first chunk
    // decrypts, but it is tagged MESSAGE, not FINAL.
    const firstChunkOnly = twoChunks().subarray(0, 1 + 65536 + 17);
    await expect(decrypt(firstChunkOnly, 65536)).rejects.toThrow(DecryptionError);
  });
});

describe('encryptFile', () => {
  it('uses a fresh key and header each time', async () => {
    const first = await encryptFile(PLAINTEXTS.allBytes);
    const second = await encryptFile(PLAINTEXTS.allBytes);
    expect(first.fileKey).not.toEqual(second.fileKey);
    expect(first.header).not.toEqual(second.header);
  });

  it(`rejects files over ${MAX_FILE_BYTES} bytes`, async () => {
    await expect(encryptFile(new Uint8Array(MAX_FILE_BYTES + 1))).rejects.toThrow(RangeError);
  });
});
