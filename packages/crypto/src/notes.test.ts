import { describe, expect, it } from 'vitest';
import { NOTES_VECTORS as V } from '../vectors/notes.generated.js';
import { REPORT_VECTORS } from '../vectors/report.generated.js';
import { CiphertextFormatError, DecryptionError } from './errors.js';
import { generateKeyPair } from './keys.js';
import { decryptNote, encryptNote, generateNotesKey, openNotesEnvelope, sealNotesEnvelope } from './notes.js';
import { decryptMessage } from './report.js';

// Tenant key pair from the vectors in keys.test.ts.
const TENANT = {
  secretKey: '3c4951628c9051c63f01644cf9caa6bbd694dfd8b17dcd85c08c6601d9e6e033',
  publicKey: '768a418dd6fffb61e9fb9f8e4ed56f6d903ae4febcc9eeaec45653bc31aff376',
};

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function tenant(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return { secretKey: fromHex(TENANT.secretKey), publicKey: fromHex(TENANT.publicKey) };
}

describe('generateNotesKey', () => {
  it('copies the given randomness and rejects the wrong length', async () => {
    const random = fromHex(V.notesKey);
    const key = await generateNotesKey(random);
    expect(key).toEqual(random);
    expect(key).not.toBe(random);
    await expect(generateNotesKey(new Uint8Array(31))).rejects.toThrow(RangeError);
  });

  it('uses randombytes_buf when no randomness is given', async () => {
    const [a, b] = [await generateNotesKey(), await generateNotesKey()];
    expect(a).toHaveLength(32);
    expect(toHex(a)).not.toBe(toHex(b));
  });
});

describe('notes envelope', () => {
  it('opens the vector envelope with the tenant key pair', async () => {
    expect(toHex(await openNotesEnvelope(fromHex(V.notesEnvelope), tenant()))).toBe(V.notesKey);
  });

  it('round trip: sealed by a handler, opened by another, in the vector format', async () => {
    const notesKey = await generateNotesKey();
    const envelope = await sealNotesEnvelope(notesKey, fromHex(TENANT.publicKey));
    expect(envelope).toHaveLength(81);
    expect(envelope[0]).toBe(0x01);
    expect(await openNotesEnvelope(envelope, tenant())).toEqual(notesKey);
  });

  it('rejects another tenant and changed data with DecryptionError', async () => {
    await expect(openNotesEnvelope(fromHex(V.notesEnvelope), await generateKeyPair())).rejects.toThrow(
      DecryptionError,
    );
    const changed = fromHex(V.notesEnvelope);
    changed[changed.length - 1]! ^= 1;
    await expect(openNotesEnvelope(changed, tenant())).rejects.toThrow(DecryptionError);
  });

  it('rejects an unknown version and wrong lengths', async () => {
    const otherVersion = fromHex(V.notesEnvelope);
    otherVersion[0] = 0x02;
    await expect(openNotesEnvelope(otherVersion, tenant())).rejects.toThrow(CiphertextFormatError);
    const envelope = fromHex(V.notesEnvelope);
    await expect(openNotesEnvelope(envelope.subarray(0, 80), tenant())).rejects.toThrow(CiphertextFormatError);
    await expect(openNotesEnvelope(new Uint8Array([...envelope, 0]), tenant())).rejects.toThrow(
      CiphertextFormatError,
    );
    await expect(openNotesEnvelope(new Uint8Array(0), tenant())).rejects.toThrow(CiphertextFormatError);
  });

  it('rejects keys of the wrong length', async () => {
    const pk = fromHex(TENANT.publicKey);
    await expect(sealNotesEnvelope(new Uint8Array(31), pk)).rejects.toThrow(/notesKey/);
    await expect(sealNotesEnvelope(fromHex(V.notesKey), new Uint8Array(31))).rejects.toThrow(RangeError);
    const shortSecret = { publicKey: pk, secretKey: new Uint8Array(31) };
    await expect(openNotesEnvelope(fromHex(V.notesEnvelope), shortSecret)).rejects.toThrow(RangeError);
  });

  it('survives tenant key rotation: reopened with the old key, sealed to the new one', async () => {
    const rotated = await generateKeyPair();
    const notesKey = await openNotesEnvelope(fromHex(V.notesEnvelope), tenant());
    const resealed = await sealNotesEnvelope(notesKey, rotated.publicKey);
    const reopened = await openNotesEnvelope(resealed, rotated);
    expect(toHex(await decryptNote(fromHex(V.note), reopened))).toBe(V.notePlaintext);
  });
});

describe('note', () => {
  it('matches the note vector', async () => {
    const note = await encryptNote(fromHex(V.notePlaintext), fromHex(V.notesKey), fromHex(V.noteNonce));
    expect(toHex(note)).toBe(V.note);
  });

  it('decrypts the note vector to UTF-8 JSON', async () => {
    const plain = await decryptNote(fromHex(V.note), fromHex(V.notesKey));
    const json = JSON.parse(new TextDecoder().decode(plain)) as { text: string };
    expect(json).toEqual({ text: 'Rückruf am Montag, nicht an die Meldeperson weitergeben. \u{1f4dd}' });
  });

  it('rejects a wrong key, changed data, an unknown version and short input', async () => {
    const note = fromHex(V.note);
    const wrongKey = fromHex(V.notesKey);
    wrongKey[0]! ^= 1;
    await expect(decryptNote(note, wrongKey)).rejects.toThrow(DecryptionError);
    const changed = Uint8Array.from(note);
    changed[30]! ^= 1;
    await expect(decryptNote(changed, fromHex(V.notesKey))).rejects.toThrow(DecryptionError);
    const otherVersion = Uint8Array.from(note);
    otherVersion[0] = 0x02;
    await expect(decryptNote(otherVersion, fromHex(V.notesKey))).rejects.toThrow(CiphertextFormatError);
    await expect(decryptNote(note.subarray(0, 40), fromHex(V.notesKey))).rejects.toThrow(DecryptionError);
  });

  it('rejects keys and nonces of the wrong length', async () => {
    const plain = fromHex(V.notePlaintext);
    await expect(encryptNote(plain, new Uint8Array(31))).rejects.toThrow(/notesKey/);
    await expect(decryptNote(fromHex(V.note), new Uint8Array(33))).rejects.toThrow(/notesKey/);
    await expect(encryptNote(plain, fromHex(V.notesKey), new Uint8Array(23))).rejects.toThrow(RangeError);
  });

  it('uses a fresh nonce for every note', async () => {
    const notesKey = fromHex(V.notesKey);
    const plain = new TextEncoder().encode('same text');
    expect(toHex(await encryptNote(plain, notesKey))).not.toBe(toHex(await encryptNote(plain, notesKey)));
  });

  it('cannot be read with the case key, so the reporter cannot read notes', async () => {
    await expect(decryptMessage(fromHex(V.note), fromHex(REPORT_VECTORS.caseKey))).rejects.toThrow(DecryptionError);
    await expect(decryptNote(fromHex(V.note), fromHex(REPORT_VECTORS.caseKey))).rejects.toThrow(DecryptionError);
  });
});
