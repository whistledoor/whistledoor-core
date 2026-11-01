import { computeFingerprint, formatFingerprint, generateKeyPair, getSodium } from '@whistledoor/crypto';
import { describe, expect, it } from 'vitest';
import { isPosterOutdated, readPosterFingerprint } from './poster';

async function tenant() {
  const { publicKey } = await generateKeyPair();
  return {
    tenantPk: (await getSodium()).to_base64(publicKey),
    fingerprint: formatFingerprint(await computeFingerprint(publicKey)),
  };
}

describe('readPosterFingerprint', () => {
  it('reads the value from the fragment', () => {
    expect(readPosterFingerprint('#fp=ABCD-EFGH')).toBe('ABCD-EFGH');
  });

  it('finds nothing without a fragment or without fp', () => {
    expect(readPosterFingerprint('')).toBeNull();
    expect(readPosterFingerprint('#')).toBeNull();
    expect(readPosterFingerprint('#other=1')).toBeNull();
  });

  it('keeps an empty fp, which is a poster that cannot match', () => {
    expect(readPosterFingerprint('#fp=')).toBe('');
    expect(readPosterFingerprint('#fp')).toBe('');
  });
});

describe('isPosterOutdated', () => {
  it('runs no check without a poster', async () => {
    const { tenantPk } = await tenant();
    expect(await isPosterOutdated(tenantPk, null)).toBe(false);
    expect(await isPosterOutdated('not a key', null)).toBe(false);
  });

  it('accepts the fingerprint of the fetched key, with or without hyphens', async () => {
    const { tenantPk, fingerprint } = await tenant();
    expect(await isPosterOutdated(tenantPk, fingerprint)).toBe(false);
    expect(await isPosterOutdated(tenantPk, fingerprint.replaceAll('-', ''))).toBe(false);
    expect(await isPosterOutdated(tenantPk, fingerprint.toLowerCase())).toBe(false);
  });

  it('flags the fingerprint of another key', async () => {
    const current = await tenant();
    const rotated = await tenant();
    expect(await isPosterOutdated(rotated.tenantPk, current.fingerprint)).toBe(true);
  });

  it('flags a short or empty fingerprint', async () => {
    const { tenantPk, fingerprint } = await tenant();
    expect(await isPosterOutdated(tenantPk, fingerprint.slice(0, 19))).toBe(true);
    expect(await isPosterOutdated(tenantPk, '')).toBe(true);
  });

  it('flags a key it cannot read, rather than letting it through', async () => {
    const { tenantPk, fingerprint } = await tenant();
    expect(await isPosterOutdated('not a key!', fingerprint)).toBe(true);
    expect(await isPosterOutdated(tenantPk.slice(0, 20), fingerprint)).toBe(true);
  });
});
