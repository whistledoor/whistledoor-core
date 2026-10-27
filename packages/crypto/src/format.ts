import { CiphertextFormatError } from './errors.js';

// crypto-design.md section 1: every stored ciphertext starts with this byte.
export const FORMAT_VERSION = 0x01;
export const KEY_BYTES = 32;

export function versioned(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(1 + parts.reduce((sum, part) => sum + part.length, 0));
  out[0] = FORMAT_VERSION;
  let offset = 1;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Checks the version byte and returns the rest. `bodyBytes` checks the exact length, if known. */
export function readVersioned(data: Uint8Array, bodyBytes?: number): Uint8Array {
  if (data[0] !== FORMAT_VERSION) {
    throw new CiphertextFormatError(`Unknown format version ${data[0]}`);
  }
  if (bodyBytes !== undefined && data.length !== 1 + bodyBytes) {
    throw new CiphertextFormatError(`Expected ${1 + bodyBytes} bytes, got ${data.length}`);
  }
  return data.subarray(1);
}

export function assertLength(name: string, bytes: Uint8Array, length: number): void {
  if (bytes.length !== length) {
    throw new RangeError(`Expected ${name} to be ${length} bytes, got ${bytes.length}`);
  }
}
