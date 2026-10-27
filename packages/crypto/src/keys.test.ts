import { describe, expect, it } from 'vitest';
import { CiphertextFormatError, DecryptionError } from './errors.js';
import {
  generateKeyPair,
  grantTenantKey,
  openTenantGrant,
  regrantTenantKey,
  unwrapHandlerSecretKey,
  wrapHandlerSecretKey,
} from './keys.js';

// Computed without libsodium by vectors/keys.py, from the pure-Python
// reference in vectors/reference.py (X25519, XSalsa20-Poly1305, sealed box).
// Grants use a fixed ephemeral key there; libsodium only has to open them.
const V = {
  kek: 'e4cd33842c6923a4ce7d6a60eb1b87a80d731749a116f2234c5e6874e49af659',
  handlerA: {
    secretKey: '1573d9f3907605d63600cee303b0a297b703bf51afd01a4f4ba24b50746aa051',
    publicKey: '337f809923afc089d542c522facce7342f613fbb7fde0e96278fedfc8b29bf1a',
  },
  handlerB: {
    secretKey: 'b81906c40dccdf1265d4a78caa9e110364f75cccd7bda0fac1308c2675d59cd1',
    publicKey: 'b6a037448d6e7ad1766e9a49b070d1c2dcb06cb1d7d3b6054ed98c2ee1f9712d',
  },
  tenantSecretKey: '3c4951628c9051c63f01644cf9caa6bbd694dfd8b17dcd85c08c6601d9e6e033',
  wrapNonce: 'a60c4ac9a55d756412752de68f558322b5d599157ba8aa2c',
  wrappedHandlerA:
    '01a60c4ac9a55d756412752de68f558322b5d599157ba8aa2cceba3538fd615ad1cad60d5613b6f4ab59c558e33ff1d3fcbc568b2b6675a1a8f7ee8c4d4e66eb379273df88ee837bc7',
  grantA:
    '0132dfe29f3e3c1faefe5c3a03adb80dcfe261650eb956d81b01ca2cb9b5460b1995a78fd42af8c8cdb99c7e14336abf841305132dfe277ef3b9ec0f89fe0b0a7638d4c4d860d0b346ed14e3d211b4d49f',
  grantB:
    '017c5191918f67d7978b45f2203eae346a5cf7a3a4a79199d69eebbdd32c06153b6d3718148e1ea7eeccb589914404ae18141bdd658905fef653ac5af13a5b2db8f17ea4309d27cddd7e6858c4ff499c61',
} as const;

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function keyPair(pair: { secretKey: string; publicKey: string }): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return { secretKey: fromHex(pair.secretKey), publicKey: fromHex(pair.publicKey) };
}

function flipLastByte(bytes: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(bytes);
  copy[copy.length - 1]! ^= 1;
  return copy;
}

describe('handler secret key wrapping', () => {
  it('matches the wrap vector', async () => {
    const wrapped = await wrapHandlerSecretKey(fromHex(V.handlerA.secretKey), fromHex(V.kek), fromHex(V.wrapNonce));
    expect(toHex(wrapped)).toBe(V.wrappedHandlerA);
  });

  it('unwraps the vector', async () => {
    const sk = await unwrapHandlerSecretKey(fromHex(V.wrappedHandlerA), fromHex(V.kek));
    expect(toHex(sk)).toBe(V.handlerA.secretKey);
  });

  it('uses a fresh random nonce when none is given', async () => {
    const sk = fromHex(V.handlerA.secretKey);
    const kek = fromHex(V.kek);
    const first = await wrapHandlerSecretKey(sk, kek);
    const second = await wrapHandlerSecretKey(sk, kek);
    expect(toHex(first)).not.toBe(toHex(second));
    expect(toHex(await unwrapHandlerSecretKey(first, kek))).toBe(V.handlerA.secretKey);
  });

  it('rejects a wrong kek and changed data with DecryptionError', async () => {
    const wrapped = fromHex(V.wrappedHandlerA);
    await expect(unwrapHandlerSecretKey(wrapped, flipLastByte(fromHex(V.kek)))).rejects.toThrow(DecryptionError);
    await expect(unwrapHandlerSecretKey(flipLastByte(wrapped), fromHex(V.kek))).rejects.toThrow(DecryptionError);
  });

  it('rejects an unknown version or wrong length with CiphertextFormatError', async () => {
    const wrapped = fromHex(V.wrappedHandlerA);
    const otherVersion = Uint8Array.from(wrapped);
    otherVersion[0] = 0x02;
    await expect(unwrapHandlerSecretKey(otherVersion, fromHex(V.kek))).rejects.toThrow(CiphertextFormatError);
    await expect(unwrapHandlerSecretKey(wrapped.subarray(0, -1), fromHex(V.kek))).rejects.toThrow(
      CiphertextFormatError,
    );
    await expect(unwrapHandlerSecretKey(new Uint8Array(0), fromHex(V.kek))).rejects.toThrow(CiphertextFormatError);
  });

  it('rejects keys of the wrong length', async () => {
    await expect(wrapHandlerSecretKey(new Uint8Array(31), fromHex(V.kek))).rejects.toThrow(RangeError);
    await expect(wrapHandlerSecretKey(fromHex(V.handlerA.secretKey), new Uint8Array(33))).rejects.toThrow(RangeError);
  });
});

describe('tenant grants', () => {
  it.each([
    ['A', V.grantA, V.handlerA],
    ['B', V.grantB, V.handlerB],
  ] as const)('opens the vector grant for handler %s', async (_, grant, handler) => {
    const tenantSk = await openTenantGrant(fromHex(grant), keyPair(handler));
    expect(toHex(tenantSk)).toBe(V.tenantSecretKey);
  });

  it("rejects another handler's grant with DecryptionError", async () => {
    await expect(openTenantGrant(fromHex(V.grantB), keyPair(V.handlerA))).rejects.toThrow(DecryptionError);
    await expect(openTenantGrant(flipLastByte(fromHex(V.grantA)), keyPair(V.handlerA))).rejects.toThrow(
      DecryptionError,
    );
  });

  it('grants and opens with fresh key pairs', async () => {
    const tenant = await generateKeyPair();
    const handler = await generateKeyPair();
    const grant = await grantTenantKey(tenant.secretKey, handler.publicKey);
    expect(grant).toHaveLength(81);
    expect(grant[0]).toBe(0x01);
    expect(await openTenantGrant(grant, handler)).toEqual(tenant.secretKey);
  });

  it('re-grant round trip: kek unwraps handler A, A re-grants to B, B opens the tenant key', async () => {
    const handlerA = {
      publicKey: fromHex(V.handlerA.publicKey),
      secretKey: await unwrapHandlerSecretKey(fromHex(V.wrappedHandlerA), fromHex(V.kek)),
    };
    const grantForB = await regrantTenantKey(fromHex(V.grantA), handlerA, fromHex(V.handlerB.publicKey));
    expect(toHex(await openTenantGrant(grantForB, keyPair(V.handlerB)))).toBe(V.tenantSecretKey);
    await expect(openTenantGrant(grantForB, handlerA)).rejects.toThrow(DecryptionError);
  });

  it('re-grant to a new key pair after a password reset', async () => {
    const reset = await generateKeyPair();
    const grant = await regrantTenantKey(fromHex(V.grantA), keyPair(V.handlerA), reset.publicKey);
    expect(toHex(await openTenantGrant(grant, reset))).toBe(V.tenantSecretKey);
  });
});

describe('generateKeyPair', () => {
  it('creates distinct 32-byte X25519 key pairs', async () => {
    const first = await generateKeyPair();
    const second = await generateKeyPair();
    expect(first.publicKey).toHaveLength(32);
    expect(first.secretKey).toHaveLength(32);
    expect(toHex(first.secretKey)).not.toBe(toHex(second.secretKey));
  });
});
