import { MAX_FILE_BYTES, decryptFile, deriveCaseKeys, encryptFile, getSodium } from '@whistledoor/crypto';
import type { ReportApi } from '@whistledoor/api-contract';

// crypto-design.md section 6. Files stay in memory, never in browser storage.

export const MAX_MESSAGE_BYTES = 100 * 1024 * 1024;

const CLEANABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// FormData sends a File's name and type, so every upload uses the same two.
const CIPHERTEXT_NAME = 'blob';
const CIPHERTEXT_TYPE = 'application/octet-stream';

// The original name is not kept, so a download gets its extension from the type.
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

/** A file picked for a report or reply, not sent yet. */
export interface DraftAttachment {
  /** The n in the default name, unique within the list. */
  number: number;
  /** Set when the reporter renames the file. */
  customName: string | undefined;
  type: string;
  data: Uint8Array;
  /** Whether metadata was removed. Only images can be cleaned. */
  cleaned: boolean;
}

export type NewAttachment = Pick<DraftAttachment, 'type' | 'data' | 'cleaned'>;

/** A draft with its final name, ready to encrypt. */
export interface AttachmentFile {
  name: string;
  type: string;
  data: Uint8Array;
}

/** What the encrypted report or message JSON says about a file. */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  fileKey: string;
  header: string;
}

export type AttachmentLimit = 'file' | 'message';

export function isCleanable(type: string): boolean {
  return CLEANABLE_TYPES.has(type);
}

/** Which limit a file of `size` bytes breaks when added to `attachments`, if any. */
export function exceededLimit(size: number, attachments: readonly DraftAttachment[]): AttachmentLimit | undefined {
  if (size > MAX_FILE_BYTES) {
    return 'file';
  }
  const total = attachments.reduce((sum, attachment) => sum + attachment.data.length, size);
  return total > MAX_MESSAGE_BYTES ? 'message' : undefined;
}

/** Adds with the lowest free number, so names stay unique after a removal. */
export function addAttachment(attachments: readonly DraftAttachment[], added: NewAttachment): DraftAttachment[] {
  const taken = new Set(attachments.map((attachment) => attachment.number));
  let number = 1;
  while (taken.has(number)) {
    number++;
  }
  return [...attachments, { ...added, number, customName: undefined }].sort((a, b) => a.number - b.number);
}

export function removeAttachment(attachments: readonly DraftAttachment[], number: number): DraftAttachment[] {
  return attachments.filter((attachment) => attachment.number !== number);
}

/** An empty name goes back to the default. */
export function renameAttachment(
  attachments: readonly DraftAttachment[],
  number: number,
  name: string,
): DraftAttachment[] {
  return attachments.map((attachment) =>
    attachment.number === number ? { ...attachment, customName: name.trim() || undefined } : attachment,
  );
}

export function attachmentName(attachment: DraftAttachment, defaultName: (number: number) => string): string {
  return attachment.customName ?? defaultName(attachment.number);
}

export function toAttachmentFiles(
  attachments: readonly DraftAttachment[],
  defaultName: (number: number) => string,
): AttachmentFile[] {
  return attachments.map((attachment) => ({
    name: attachmentName(attachment, defaultName),
    type: attachment.type,
    data: attachment.data,
  }));
}

/** Encrypts and uploads each file. A retry uploads again; the server drops what stays unreferenced. */
export async function uploadAttachments(
  api: ReportApi,
  lookupId: string,
  files: readonly AttachmentFile[],
): Promise<Attachment[]> {
  const sodium = await getSodium();
  const attachments: Attachment[] = [];
  for (const { name, type, data } of files) {
    const { ciphertext, fileKey, header } = await encryptFile(data);
    const object = new File([ciphertext as Uint8Array<ArrayBuffer>], CIPHERTEXT_NAME, { type: CIPHERTEXT_TYPE });
    const { id } = await api.file.upload({ lookupId, ciphertext: object });
    attachments.push({
      id,
      name,
      type,
      size: data.length,
      fileKey: sodium.to_base64(fileKey),
      header: sodium.to_base64(header),
    });
    sodium.memzero(fileKey);
  }
  return attachments;
}

export async function downloadAttachment(
  api: ReportApi,
  code: Uint8Array,
  attachment: Attachment,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const { lookupId } = await deriveCaseKeys(code);
  const ciphertext = await api.file.download({ lookupId: sodium.to_base64(lookupId), id: attachment.id });
  return decryptFile(
    new Uint8Array(await ciphertext.arrayBuffer()),
    sodium.from_base64(attachment.fileKey),
    sodium.from_base64(attachment.header),
    attachment.size,
  );
}

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { id, name, type, size, fileKey, header } = value as Record<string, unknown>;
  return (
    [id, name, type, fileKey, header].every((field) => typeof field === 'string') &&
    Number.isSafeInteger(size) &&
    (size as number) >= 0
  );
}

/** Reads the `attachments` field of a decrypted JSON, which a handler's client may have written. */
export function parseAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? value.filter(isAttachment) : [];
}

/** The name to save a file under: `Anhang 1` of type image/png becomes `Anhang 1.png`. */
export function downloadName({ name, type }: Pick<Attachment, 'name' | 'type'>): string {
  const extension = EXTENSIONS[type];
  return extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
}
