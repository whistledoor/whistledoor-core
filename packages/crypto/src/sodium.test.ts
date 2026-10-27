import { describe, expect, it } from 'vitest';
import { getSodium } from './sodium.js';

describe('getSodium', () => {
  it('loads the sumo build, which includes Argon2id', async () => {
    const sodium = await getSodium();
    expect(sodium.crypto_pwhash_ALG_ARGON2ID13).toBe(2);
  });

  it('matches the BLAKE2b-256 test vector for the empty input', async () => {
    const sodium = await getSodium();
    const hash = sodium.crypto_generichash(32, new Uint8Array(0), null);
    expect(sodium.to_hex(hash)).toBe('0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8');
  });
});
