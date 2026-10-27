import { describe, expect, it } from 'vitest';
import { RECOVERY_TENANT_PUBLIC_KEY, RECOVERY_VECTORS } from '../vectors/recovery.generated.js';
import { DecryptionError } from './errors.js';
import { generateKeyPair, grantTenantKey, openTenantGrant, regrantTenantKey } from './keys.js';
import {
  RecoveryKeyError,
  deriveRecoveryKeyPair,
  formatRecoveryKey,
  generateRecoveryKey,
  parseRecoveryKey,
} from './recovery.js';
import { getSodium } from './sodium.js';

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// The vectors hold no secret keys. A recovered secret key is checked through
// its public key (test-only use of crypto_scalarmult_base).
async function publicKeyOf(secretKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return toHex(sodium.crypto_scalarmult_base(secretKey));
}

describe.each(RECOVERY_VECTORS)('vector: $name', (vector) => {
  it('formats and parses', () => {
    expect(formatRecoveryKey(fromHex(vector.bytes))).toBe(vector.formatted);
    expect(toHex(parseRecoveryKey(vector.formatted))).toBe(vector.bytes);
  });

  it('derives the public key', async () => {
    const pair = await deriveRecoveryKeyPair(fromHex(vector.bytes));
    expect(toHex(pair.publicKey)).toBe(vector.publicKey);
    expect(await publicKeyOf(pair.secretKey)).toBe(vector.publicKey);
  });

  // Opening the grant also proves the derived secret key is the right one.
  it('opens the recovery grant to the tenant key', async () => {
    const pair = await deriveRecoveryKeyPair(parseRecoveryKey(vector.formatted));
    const tenantSk = await openTenantGrant(fromHex(vector.grant), pair);
    expect(await publicKeyOf(tenantSk)).toBe(RECOVERY_TENANT_PUBLIC_KEY);
  });
});

describe('recovery flow', () => {
  it('onboarding → forgotten password → recovery key re-grants to a new handler key pair', async () => {
    const tenant = await generateKeyPair();
    const recoveryKey = await generateRecoveryKey();
    const shown = formatRecoveryKey(recoveryKey);
    const recoveryGrant = await grantTenantKey(tenant.secretKey, (await deriveRecoveryKeyPair(recoveryKey)).publicKey);

    // Later: the key is typed back from the printout, sloppily.
    const typed = shown.toLowerCase().replaceAll('-', ' ').replaceAll('1', 'l').replaceAll('0', 'o');
    const recovery = await deriveRecoveryKeyPair(parseRecoveryKey(typed));
    const newHandler = await generateKeyPair();
    const handlerGrant = await regrantTenantKey(recoveryGrant, recovery, newHandler.publicKey);
    expect(await openTenantGrant(handlerGrant, newHandler)).toEqual(tenant.secretKey);
  });

  it('a different recovery key cannot open the grant', async () => {
    const vector = RECOVERY_VECTORS[2];
    const other = await deriveRecoveryKeyPair(fromHex(RECOVERY_VECTORS[0].bytes));
    await expect(openTenantGrant(fromHex(vector.grant), other)).rejects.toThrow(DecryptionError);
  });
});

describe('generateRecoveryKey', () => {
  it('copies the given randomness and rejects the wrong length', async () => {
    const random = fromHex(RECOVERY_VECTORS[2].bytes);
    const key = await generateRecoveryKey(random);
    expect(key).toEqual(random);
    expect(key).not.toBe(random);
    await expect(generateRecoveryKey(new Uint8Array(19))).rejects.toThrow(RangeError);
  });

  it('uses randombytes_buf when no randomness is given', async () => {
    const key = await generateRecoveryKey();
    expect(key).toHaveLength(20);
    expect(parseRecoveryKey(formatRecoveryKey(key))).toEqual(key);
  });
});

describe('parseRecoveryKey', () => {
  it.each(['', '0410-6105-0R3G-G28A-1C60-T3GF-208H-44R', '0410-6105-0R3G-G28A-1C60-T3GF-208H-44RMX'])(
    'rejects wrong length: "%s"',
    (input) => {
      expect(() => parseRecoveryKey(input)).toThrow(expect.objectContaining({ reason: 'length' }));
    },
  );

  it('rejects an invalid character with RecoveryKeyError', () => {
    expect(() => parseRecoveryKey('0410-6105-0R3G-G28A-1C60-T3GF-208H-44RU')).toThrow(RecoveryKeyError);
  });

  it('does not accept a case code', () => {
    expect(() => parseRecoveryKey('0410-6105-0R3G-G28A-1C6D')).toThrow(RecoveryKeyError);
  });
});
