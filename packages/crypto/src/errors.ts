/** A stored ciphertext has an unknown format version or the wrong length. */
export class CiphertextFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CiphertextFormatError';
  }
}

/** Authentication failed: wrong key, or the ciphertext was changed. */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}
