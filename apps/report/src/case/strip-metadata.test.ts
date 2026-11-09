import { describe, expect, it } from 'vitest';
import { MalformedImageError, stripJpeg, stripMetadata, stripPng } from './strip-metadata';

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

function segment(marker: number, data: number[]): number[] {
  const length = data.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...data];
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const APP0 = segment(0xe0, [...ascii('JFIF\0'), 1, 2, 0, 0, 1, 0, 1, 0, 0]);
const EXIF = segment(0xe1, [...ascii('Exif\0\0'), ...ascii('GPS 48.2082 16.3738')]);
const XMP = segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta creator="Max"/>'));
const ICC = segment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, 9, 9]);
const FLASHPIX = segment(0xe2, ascii('FPXR\0secret'));
const IPTC = segment(0xed, ascii('Photoshop 3.0\0byline'));
const ADOBE = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
const COMMENT = segment(0xfe, ascii('Taken by Max Muster'));
const DQT = segment(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]);
// SOS header, then entropy data that happens to contain 0xff 0x00 and a restart marker.
const SCAN = [...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, ...EOI];

const jpeg = (...parts: number[][]): Uint8Array => new Uint8Array(parts.flat());

function crc32(bytes: number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: number[]): number[] {
  const body = [...ascii(type), ...data];
  const crc = crc32(body);
  const length = data.length;
  return [length >>> 24, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff, ...body, crc >>> 24, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff];
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const ICCP = chunk('iCCP', ascii('sRGB\0\0x'));
const TEXT = chunk('tEXt', ascii('Author\0Max Muster'));
const ITXT = chunk('iTXt', ascii('XML:com.adobe.xmp\0\0\0\0\0<x/>'));
const ZTXT = chunk('zTXt', ascii('Comment\0\0x'));
const EXIF_CHUNK = chunk('eXIf', ascii('MM\0*GPS'));
const TIME = chunk('tIME', [7, 234, 11, 8, 12, 0, 0]);
const IDAT = chunk('IDAT', [0x78, 0x9c, 0x63, 0, 0, 0, 2, 0, 1]);
const IEND = chunk('IEND', []);

const png = (...parts: number[][]): Uint8Array => new Uint8Array(parts.flat());

describe('stripJpeg', () => {
  it('drops EXIF, XMP, IPTC, FlashPix and comments', () => {
    const input = jpeg(SOI, APP0, EXIF, XMP, ICC, FLASHPIX, IPTC, ADOBE, COMMENT, DQT, SCAN);
    expect(stripJpeg(input)).toEqual(jpeg(SOI, APP0, ICC, ADOBE, DQT, SCAN));
  });

  it('leaves a clean JPEG unchanged', () => {
    const input = jpeg(SOI, APP0, DQT, SCAN);
    expect(stripJpeg(input)).toEqual(input);
  });

  it('keeps the scan data as it is', () => {
    const output = stripJpeg(jpeg(SOI, EXIF, SCAN));
    expect(Array.from(output.slice(-SCAN.length))).toEqual(SCAN);
  });

  it('skips fill bytes before a marker', () => {
    expect(stripJpeg(jpeg(SOI, [0xff], EXIF, DQT, SCAN))).toEqual(jpeg(SOI, DQT, SCAN));
  });

  it.each([
    ['not a JPEG', jpeg(ascii('GIF89a'))],
    ['a truncated segment', jpeg(SOI, EXIF.slice(0, 10))],
    ['a bad length', jpeg(SOI, [0xff, 0xe1, 0x00, 0x01], DQT, SCAN)],
    ['no image data', jpeg(SOI, APP0)],
    ['junk between segments', jpeg(SOI, APP0, [0x00], DQT, SCAN)],
  ])('rejects %s', (_, input) => {
    expect(() => stripJpeg(input)).toThrow(MalformedImageError);
  });
});

describe('stripPng', () => {
  it('drops text, EXIF and time chunks', () => {
    const input = png(SIGNATURE, IHDR, ICCP, TEXT, ITXT, ZTXT, EXIF_CHUNK, TIME, IDAT, IEND);
    expect(stripPng(input)).toEqual(png(SIGNATURE, IHDR, ICCP, IDAT, IEND));
  });

  it('leaves a clean PNG unchanged', () => {
    const input = png(SIGNATURE, IHDR, IDAT, IEND);
    expect(stripPng(input)).toEqual(input);
  });

  it('ignores bytes after IEND', () => {
    expect(stripPng(png(SIGNATURE, IHDR, IDAT, IEND, TEXT))).toEqual(png(SIGNATURE, IHDR, IDAT, IEND));
  });

  it.each([
    ['not a PNG', png(SIGNATURE.slice(0, 4), IHDR)],
    ['a chunk longer than the file', png(SIGNATURE, IHDR.slice(0, 12))],
    ['no IEND', png(SIGNATURE, IHDR, IDAT)],
  ])('rejects %s', (_, input) => {
    expect(() => stripPng(input)).toThrow(MalformedImageError);
  });

  it('works on a view into a larger buffer', () => {
    const inner = png(SIGNATURE, IHDR, TEXT, IDAT, IEND);
    const outer = new Uint8Array(inner.length + 8);
    outer.set(inner, 4);
    expect(stripPng(outer.subarray(4, 4 + inner.length))).toEqual(png(SIGNATURE, IHDR, IDAT, IEND));
  });
});

describe('stripMetadata', () => {
  it('passes other types through', () => {
    const pdf = new Uint8Array(ascii('%PDF-1.7 /Author (Max)'));
    expect(stripMetadata('application/pdf', pdf)).toBe(pdf);
    expect(stripMetadata('image/webp', pdf)).toBe(pdf);
  });

  it('picks the parser by type', () => {
    expect(stripMetadata('image/jpeg', jpeg(SOI, EXIF, SCAN))).toEqual(jpeg(SOI, SCAN));
    expect(stripMetadata('image/png', png(SIGNATURE, IHDR, TEXT, IDAT, IEND))).toEqual(png(SIGNATURE, IHDR, IDAT, IEND));
  });
});
