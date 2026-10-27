import { describe, expect, it } from 'vitest';
import { REPORT_VECTORS as V } from '../vectors/report.generated.js';
import { deriveCaseKeys, parseCaseCode } from './case-code.js';
import { CiphertextFormatError, DecryptionError } from './errors.js';
import { generateKeyPair } from './keys.js';
import { decryptMessage, encryptMessage, openEnvelope, sealReport } from './report.js';

// Tenant key pair from the vectors in keys.test.ts; the case key is the one
// derived from the case code below (case-code.test.ts, vector "counting").
const TENANT = {
  secretKey: '3c4951628c9051c63f01644cf9caa6bbd694dfd8b17dcd85c08c6601d9e6e033',
  publicKey: '768a418dd6fffb61e9fb9f8e4ed56f6d903ae4febcc9eeaec45653bc31aff376',
};
const CASE_CODE = '0410-6105-0R3G-G28A-1C6DW';

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function tenant(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return { secretKey: fromHex(TENANT.secretKey), publicKey: fromHex(TENANT.publicKey) };
}

describe('envelope', () => {
  it('opens the vector envelope with the tenant key pair', async () => {
    expect(toHex(await openEnvelope(fromHex(V.envelope), tenant()))).toBe(V.caseKey);
  });

  it('rejects another tenant and changed data with DecryptionError', async () => {
    await expect(openEnvelope(fromHex(V.envelope), await generateKeyPair())).rejects.toThrow(DecryptionError);
    const changed = fromHex(V.envelope);
    changed[changed.length - 1]! ^= 1;
    await expect(openEnvelope(changed, tenant())).rejects.toThrow(DecryptionError);
  });
});

describe('report text', () => {
  it('matches the report vector', async () => {
    const report = await encryptMessage(fromHex(V.reportPlaintext), fromHex(V.caseKey), fromHex(V.reportNonce));
    expect(toHex(report)).toBe(V.report);
  });

  it('decrypts the report vector to UTF-8 JSON', async () => {
    const plain = await decryptMessage(fromHex(V.report), fromHex(V.caseKey));
    const json = JSON.parse(new TextDecoder().decode(plain)) as { seq: number; role: string; text: string };
    expect(json).toEqual({ seq: 0, role: 'reporter', text: 'Grüße aus Wien.\nZeile 2 \u{1f511}' });
  });

  it('rejects a wrong case key, changed data, an unknown version and short input', async () => {
    const report = fromHex(V.report);
    const wrongKey = fromHex(V.caseKey);
    wrongKey[0]! ^= 1;
    await expect(decryptMessage(report, wrongKey)).rejects.toThrow(DecryptionError);
    const changed = Uint8Array.from(report);
    changed[30]! ^= 1;
    await expect(decryptMessage(changed, fromHex(V.caseKey))).rejects.toThrow(DecryptionError);
    const otherVersion = Uint8Array.from(report);
    otherVersion[0] = 0x02;
    await expect(decryptMessage(otherVersion, fromHex(V.caseKey))).rejects.toThrow(CiphertextFormatError);
    await expect(decryptMessage(report.subarray(0, 40), fromHex(V.caseKey))).rejects.toThrow(DecryptionError);
  });
});

describe('sealReport', () => {
  it('round trip: case code → submit → handler opens envelope and report, reporter rereads it', async () => {
    const caseKeys = await deriveCaseKeys(parseCaseCode(CASE_CODE));
    expect(toHex(caseKeys.caseKey)).toBe(V.caseKey);

    const sealed = await sealReport(fromHex(V.reportPlaintext), caseKeys, fromHex(TENANT.publicKey));
    expect(sealed.lookupId).toEqual(caseKeys.lookupId);

    const handlerCaseKey = await openEnvelope(sealed.envelope, tenant());
    expect(toHex(await decryptMessage(sealed.report, handlerCaseKey))).toBe(V.reportPlaintext);

    const reporterKeys = await deriveCaseKeys(parseCaseCode(CASE_CODE.toLowerCase()));
    expect(toHex(await decryptMessage(sealed.report, reporterKeys.caseKey))).toBe(V.reportPlaintext);
  });

  it('uses a fresh nonce for every message', async () => {
    const caseKey = fromHex(V.caseKey);
    const plain = new TextEncoder().encode('same text');
    expect(toHex(await encryptMessage(plain, caseKey))).not.toBe(toHex(await encryptMessage(plain, caseKey)));
  });
});
