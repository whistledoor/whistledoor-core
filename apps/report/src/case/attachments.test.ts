import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, generateCaseCode } from '@whistledoor/crypto';
import { createFakeApi } from '../api/fake';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import {
  MAX_MESSAGE_BYTES,
  addAttachment,
  attachmentName,
  downloadAttachment,
  downloadName,
  exceededLimit,
  isCleanable,
  parseAttachments,
  removeAttachment,
  renameAttachment,
  toAttachmentFiles,
} from './attachments';
import type { AttachmentFile, DraftAttachment } from './attachments';
import { openCase, postMessage, submitReport } from './case';
import type { ReportContent } from './case';

const report: ReportContent = { kind: 'anonymous', category: 'fraud', text: 'Hinweis' };
const pdf: AttachmentFile = {
  name: 'Rechnung',
  type: 'application/pdf',
  data: new TextEncoder().encode('Geheimer Inhalt'),
};
const empty = { type: 'text/plain', data: new Uint8Array(), cleaned: false };

async function fixture() {
  const api = createFakeApi();
  const code = await generateCaseCode();
  const { tenantPk } = await api.tenant.get();
  return { api, code, tenantPk };
}

// Sizes without allocating the bytes: the limits read only `.length`.
function ofSize(size: number, count: number): DraftAttachment[] {
  return Array.from({ length: count }, (_, index) => ({
    ...empty,
    number: index + 1,
    customName: undefined,
    data: { length: size } as Uint8Array,
  }));
}

describe('attachment round trip', () => {
  it('reads a report attachment back from the fake API', async () => {
    const { api, code, tenantPk } = await fixture();

    await submitReport(api, code, report, tenantPk, [pdf]);
    const { messages, issues } = await openCase(api, code);
    const attachment = messages[0]!.attachments[0]!;

    expect(issues).toEqual([]);
    expect(attachment).toMatchObject({ name: 'Rechnung', type: 'application/pdf', size: pdf.data.length });
    expect(await downloadAttachment(api, code, attachment)).toEqual(pdf.data);
  });

  it('keeps attachments under the message that carries them', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, report, tenantPk);
    const opened = await openCase(api, code);

    await postMessage(api, code, 'Nachtrag', opened.messages[0]!, false, [pdf]);
    const { messages, issues } = await openCase(api, code);

    expect(issues).toEqual([]);
    expect(messages[0]!.attachments).toEqual([]);
    expect(await downloadAttachment(api, code, messages[1]!.attachments[0]!)).toEqual(pdf.data);
  });

  it('round-trips an empty file', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, report, tenantPk, [{ ...pdf, data: new Uint8Array() }]);

    const { messages } = await openCase(api, code);

    expect(await downloadAttachment(api, code, messages[0]!.attachments[0]!)).toHaveLength(0);
  });

  it('uploads first, while no case exists yet', async () => {
    const { api, code, tenantPk } = await fixture();
    const order: string[] = [];
    const { upload } = api.file;
    const { submit } = api.report;
    api.file.upload = (input) => {
      order.push('upload');
      return upload(input);
    };
    api.report.submit = (input) => {
      order.push('submit');
      return submit(input);
    };

    await submitReport(api, code, report, tenantPk, [pdf, pdf]);

    expect(order).toEqual(['upload', 'upload', 'submit']);
  });

  it('refuses a download for another case', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, report, tenantPk, [pdf]);
    const { messages } = await openCase(api, code);
    const other = await generateCaseCode();

    await expect(downloadAttachment(api, other, messages[0]!.attachments[0]!)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a changed object', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, report, tenantPk, [pdf]);
    const { messages } = await openCase(api, code);
    const { download } = api.file;
    api.file.download = async (input) => {
      const bytes = new Uint8Array(await (await download(input)).arrayBuffer());
      bytes[bytes.length - 1]! ^= 1;
      return new File([bytes], 'blob');
    };

    await expect(downloadAttachment(api, code, messages[0]!.attachments[0]!)).rejects.toThrow();
  });
});

describe('limits', () => {
  it('allows a file of exactly the limit', () => {
    expect(exceededLimit(MAX_FILE_BYTES, [])).toBeUndefined();
  });

  it('refuses a larger file', () => {
    expect(exceededLimit(MAX_FILE_BYTES + 1, [])).toBe('file');
  });

  it('allows a message of exactly the limit', () => {
    expect(MAX_MESSAGE_BYTES).toBe(4 * MAX_FILE_BYTES);
    expect(exceededLimit(MAX_FILE_BYTES, ofSize(MAX_FILE_BYTES, 3))).toBeUndefined();
  });

  it('refuses one byte over the message limit', () => {
    expect(exceededLimit(1, ofSize(MAX_FILE_BYTES, 4))).toBe('message');
  });
});

describe('names', () => {
  const three = [empty, empty, empty].reduce<DraftAttachment[]>(addAttachment, []);

  it('numbers in German and English', () => {
    expect(three.map((attachment) => attachmentName(attachment, de.attachmentDefaultName))).toEqual([
      'Anhang 1',
      'Anhang 2',
      'Anhang 3',
    ]);
    expect(attachmentName(three[0]!, en.attachmentDefaultName)).toBe('Attachment 1');
  });

  it('reuses a free number, so no two files share a name', () => {
    const numbers = addAttachment(removeAttachment(three, 1), empty).map((attachment) => attachment.number);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('renames one file and goes back to the default on an empty name', () => {
    const renamed = renameAttachment(three, 2, '  Foto  ');
    expect(toAttachmentFiles(renamed, de.attachmentDefaultName).map((file) => file.name)).toEqual([
      'Anhang 1',
      'Foto',
      'Anhang 3',
    ]);
    expect(attachmentName(renameAttachment(renamed, 2, ' ')[1]!, de.attachmentDefaultName)).toBe('Anhang 2');
  });

  it('adds the extension to a download once', () => {
    expect(downloadName({ name: 'Anhang 1', type: 'image/jpeg' })).toBe('Anhang 1.jpg');
    expect(downloadName({ name: 'foto.JPG', type: 'image/jpeg' })).toBe('foto.JPG');
    expect(downloadName({ name: 'Anhang 1', type: 'application/x-unknown' })).toBe('Anhang 1');
  });

  it('counts for the summary', () => {
    expect([de.attachmentCount(1), de.attachmentCount(2)]).toEqual(['1 Anhang', '2 Anhänge']);
    expect([en.attachmentCount(1), en.attachmentCount(2)]).toEqual(['1 attachment', '2 attachments']);
  });
});

describe('metadata', () => {
  it('cleans exactly the three image types', () => {
    expect(['image/jpeg', 'image/png', 'image/webp'].every(isCleanable)).toBe(true);
    expect(['application/pdf', 'image/heic', 'image/gif', ''].some(isCleanable)).toBe(false);
  });
});

describe('parseAttachments', () => {
  const valid = { id: '1', name: 'a', type: '', size: 0, fileKey: 'k', header: 'h' };

  it('keeps well-formed entries and drops the rest', () => {
    expect(parseAttachments([valid, { ...valid, size: -1 }, { ...valid, id: 1 }, null, 'x'])).toEqual([valid]);
  });

  it('reads a missing field as no attachments', () => {
    expect(parseAttachments(undefined)).toEqual([]);
  });
});
