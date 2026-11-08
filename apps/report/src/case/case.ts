import {
  checkChain,
  createChainLink,
  decryptMessage,
  deriveCaseKeys,
  encryptMessage,
  formatCaseCode,
  getSodium,
  normalizeCrockford,
  parseChainLink,
  sealReport,
} from '@whistledoor/crypto';
import type { ChainIssue, ChainLink, ChainedMessage, MessageRole } from '@whistledoor/crypto';
import type { CaseStatus, OpenedCase, ReportApi, StoredMessage } from '@whistledoor/api-contract';
import { parseAttachments, uploadAttachments } from './attachments';
import type { Attachment, AttachmentFile, DraftAttachment } from './attachments';
import { isCategory } from './categories';
import type { Category, ReportKind } from './categories';

// The reporter's side of crypto-design.md sections 2 and 5.

export interface ReportDraft {
  kind: ReportKind;
  name: string;
  phone: string;
  category: Category | '';
  text: string;
  attachments: DraftAttachment[];
}

export const EMPTY_DRAFT: ReportDraft = {
  kind: 'anonymous',
  name: '',
  phone: '',
  category: '',
  text: '',
  attachments: [],
};

export interface MessageContent {
  text: string;
  attachments?: Attachment[];
}

export interface ReportContent extends MessageContent {
  kind: ReportKind;
  category: Category;
  name?: string;
  phone?: string;
}

export interface CaseMessage extends ChainedMessage {
  id: string;
  createdAt: string;
  role: MessageRole;
  text: string;
  attachments: Attachment[];
  /** Only on the report itself. */
  category?: Category;
}

export interface OpenCase {
  status: CaseStatus;
  /** Report first, then messages, ordered by `seq`. */
  messages: CaseMessage[];
  issues: ChainIssue[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function toBase64(bytes: Uint8Array): Promise<string> {
  return (await getSodium()).to_base64(bytes);
}

export async function fromBase64(text: string): Promise<Uint8Array> {
  return (await getSodium()).from_base64(text);
}

function encode(link: ChainLink, content: MessageContent): Uint8Array {
  return encoder.encode(JSON.stringify({ ...link, ...content }));
}

function withAttachments<T extends MessageContent>(content: T, attachments: Attachment[]): T {
  return attachments.length > 0 ? { ...content, attachments } : content;
}

/** An anonymous report carries no identity, even if the fields were filled in before switching. */
export function toReportContent(draft: ReportDraft, category: Category): ReportContent {
  const content: ReportContent = { kind: draft.kind, category, text: draft.text.trim() };
  if (draft.kind === 'confidential') {
    if (draft.name.trim()) {
      content.name = draft.name.trim();
    }
    if (draft.phone.trim()) {
      content.phone = draft.phone.trim();
    }
  }
  return content;
}

/** The last group of the formatted code, which the reporter types to confirm. */
export function lastGroup(code: Uint8Array): string {
  return formatCaseCode(code).split('-').at(-1)!;
}

/** Ignores case, spaces and dashes, and reads O as 0 and I or L as 1, like the case code itself. */
export function matchesLastGroup(code: Uint8Array, input: string): boolean {
  return normalizeCrockford(input) === lastGroup(code);
}

export async function submitReport(
  api: ReportApi,
  code: Uint8Array,
  content: ReportContent,
  tenantPk: string,
  files: readonly AttachmentFile[] = [],
): Promise<void> {
  const keys = await deriveCaseKeys(code);
  const attachments = await uploadAttachments(api, await toBase64(keys.lookupId), files);
  const link = await createChainLink('reporter');
  const json = encode(link, withAttachments(content, attachments));
  const sealed = await sealReport(json, keys, await fromBase64(tenantPk));
  await api.report.submit({
    lookupId: await toBase64(sealed.lookupId),
    envelope: await toBase64(sealed.envelope),
    report: await toBase64(sealed.report),
    fileIds: attachments.map((attachment) => attachment.id),
  });
}

async function readMessage(stored: StoredMessage, caseKey: Uint8Array): Promise<CaseMessage> {
  const ciphertext = await fromBase64(stored.ciphertext);
  const json: unknown = JSON.parse(decoder.decode(await decryptMessage(ciphertext, caseKey)));
  const link = parseChainLink(json);
  const { text, category, attachments } = json as { text: string; category?: unknown; attachments?: unknown };
  return {
    id: stored.id,
    createdAt: stored.createdAt,
    ciphertext,
    link,
    role: link.role,
    text,
    attachments: parseAttachments(attachments),
    ...(isCategory(category) ? { category } : {}),
  };
}

export async function openCase(api: ReportApi, code: Uint8Array): Promise<OpenCase> {
  const { lookupId, caseKey } = await deriveCaseKeys(code);
  const opened: OpenedCase = await api.case.open({ lookupId: await toBase64(lookupId) });
  const stored = [opened.report, ...opened.messages];
  const messages = await Promise.all(stored.map((message) => readMessage(message, caseKey)));
  const { ordered, issues } = await checkChain(messages);
  return { status: opened.status, messages: ordered, issues };
}

export async function postMessage(
  api: ReportApi,
  code: Uint8Array,
  text: string,
  previous: CaseMessage,
  meetingRequest: boolean,
  files: readonly AttachmentFile[] = [],
): Promise<void> {
  const keys = await deriveCaseKeys(code);
  const lookupId = await toBase64(keys.lookupId);
  const attachments = await uploadAttachments(api, lookupId, files);
  const link = await createChainLink('reporter', previous);
  const json = encode(link, withAttachments({ text }, attachments));
  await api.case.postMessage({
    lookupId,
    ciphertext: await toBase64(await encryptMessage(json, keys.caseKey)),
    meetingRequest,
    fileIds: attachments.map((attachment) => attachment.id),
  });
}
