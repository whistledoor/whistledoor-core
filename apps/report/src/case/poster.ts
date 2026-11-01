import { computeFingerprint, fingerprintMatches } from '@whistledoor/crypto';
import { fromBase64 } from './case';

// crypto-design.md section 4, fingerprints: the reporter's side of the QR poster.

/** The `fp` value of a URL fragment, or null if there is none. Reporters who typed the address have none. */
export function readPosterFingerprint(hash: string): string | null {
  return new URLSearchParams(hash.slice(1)).get('fp');
}

/**
 * Compares the poster's fingerprint with the fetched `tenantPk`. Without a poster
 * there is nothing to compare. With one, anything short of a match counts as
 * outdated, including a key that can't be read.
 */
export async function isPosterOutdated(tenantPk: string, fingerprint: string | null): Promise<boolean> {
  if (fingerprint === null) {
    return false;
  }
  try {
    return !fingerprintMatches(await computeFingerprint(await fromBase64(tenantPk)), fingerprint);
  } catch {
    return true;
  }
}
