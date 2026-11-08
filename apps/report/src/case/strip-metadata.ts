// crypto-design.md section 6, Metadata. The canvas re-encoding in clean-image.ts
// already drops EXIF; this pass removes metadata containers at the byte level as
// well, so the result does not depend on what a browser's encoder writes. Pure,
// so it runs in Node tests too.

const JPEG_SOI = 0xd8;
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;
const JPEG_APP0 = 0xe0;
const JPEG_APP2 = 0xe2;
const JPEG_APP14 = 0xee;
const JPEG_APP15 = 0xef;
const JPEG_COM = 0xfe;
const ICC_PROFILE = 'ICC_PROFILE\0';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Text, EXIF and the modification time. Colour and pixel chunks stay. */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

export class MalformedImageError extends Error {}

function startsWith(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Whether a JPEG segment may stay: JFIF (APP0), Adobe (APP14, needed to decode
 * CMYK) and an ICC colour profile. EXIF, XMP, IPTC, FlashPix, comments and every
 * other application segment go.
 */
function keepJpegSegment(marker: number, bytes: Uint8Array, dataStart: number): boolean {
  if (marker === JPEG_COM) {
    return false;
  }
  if (marker < JPEG_APP0 || marker > JPEG_APP15) {
    return true;
  }
  if (marker === JPEG_APP0 || marker === JPEG_APP14) {
    return true;
  }
  return marker === JPEG_APP2 && startsWith(bytes, dataStart, ICC_PROFILE);
}

/** Removes metadata segments from a JPEG. Throws on anything it cannot parse. */
export function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) {
    throw new MalformedImageError('Not a JPEG');
  }
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new MalformedImageError('Expected a marker');
    }
    // Fill bytes before a marker.
    let markerAt = offset;
    while (bytes[markerAt + 1] === 0xff) {
      markerAt++;
    }
    const marker = bytes[markerAt + 1];
    if (marker === undefined) {
      throw new MalformedImageError('Truncated marker');
    }
    if (marker === JPEG_EOI) {
      parts.push(bytes.subarray(markerAt, markerAt + 2));
      return concat(parts);
    }
    if (markerAt + 4 > bytes.length) {
      throw new MalformedImageError('Truncated segment');
    }
    const length = (bytes[markerAt + 2]! << 8) | bytes[markerAt + 3]!;
    const end = markerAt + 2 + length;
    if (length < 2 || end > bytes.length) {
      throw new MalformedImageError('Bad segment length');
    }
    if (marker === JPEG_SOS) {
      // Entropy-coded data follows; segment markers no longer appear in it.
      parts.push(bytes.subarray(markerAt));
      return concat(parts);
    }
    if (keepJpegSegment(marker, bytes, markerAt + 4)) {
      parts.push(bytes.subarray(markerAt, end));
    }
    offset = end;
  }
  throw new MalformedImageError('No image data');
}

/** Removes text, EXIF and time chunks from a PNG. Throws on anything it cannot parse. */
export function stripPng(bytes: Uint8Array): Uint8Array {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new MalformedImageError('Not a PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, PNG_SIGNATURE.length)];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) {
      throw new MalformedImageError('Bad chunk length');
    }
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!PNG_METADATA_CHUNKS.has(type)) {
      parts.push(bytes.subarray(offset, end));
    }
    if (type === 'IEND') {
      return concat(parts);
    }
    offset = end;
  }
  throw new MalformedImageError('No IEND chunk');
}

/** Strips JPEG and PNG; other types are returned unchanged. */
export function stripMetadata(type: string, bytes: Uint8Array): Uint8Array {
  if (type === 'image/jpeg') {
    return stripJpeg(bytes);
  }
  if (type === 'image/png') {
    return stripPng(bytes);
  }
  return bytes;
}
