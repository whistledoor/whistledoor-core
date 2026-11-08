import { isCleanable } from './attachments';
import type { NewAttachment } from './attachments';
import { stripMetadata } from './strip-metadata';

const JPEG_QUALITY = 0.92;

// Browser only, which is why this is apart from attachments.ts.
async function reencode(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Cannot encode image'))),
        file.type,
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Reads a picked file. JPEG, PNG and WebP go through a canvas, which drops EXIF,
 * and JPEG and PNG then lose any metadata segment the encoder still wrote.
 * Rejects if an image cannot be decoded: it must not be sent uncleaned.
 */
export async function readAttachment(file: File): Promise<NewAttachment> {
  if (!isCleanable(file.type)) {
    return { type: file.type, data: new Uint8Array(await file.arrayBuffer()), cleaned: false };
  }
  const blob = await reencode(file);
  // Not file.type: a browser that can't encode WebP returns PNG instead.
  return { type: blob.type, data: stripMetadata(blob.type, new Uint8Array(await blob.arrayBuffer())), cleaned: true };
}
