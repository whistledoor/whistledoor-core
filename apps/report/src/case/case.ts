import {
  checkChain,
  createChainLink,
  decryptMessage,
  deriveCaseKeys,
  encryptMessage,
  formatCaseCode,
  getSodium,
  parseChainLink,
  sealReport,
} from '@whistledoor/crypto';
import type { ChainIssue, ChainLink, ChainedMessage, MessageRole } from '@whistledoor/crypto';
import type { CaseStatus, OpenedCase, ReportApi, StoredMessage } from '@whistledoor/api-contract';
import { isCategory } from './categories';
import type { Category, ReportKind } from './categories';

// The reporter's side of crypto-design.md sections 2 and 5.

export interface ReportDraft {
  kind: ReportKind;
  name: string;
  phone: string;
  category: Category | '';
  text: string;
}

export const EMPTY_DRAFT: ReportDraft = { kind: 'anonymous', name: '', phone: '', category: '', text: '' };

export interface MessageContent {
  text: string;
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

async function fromBase64(text: string): Promise<Uint8Array> {
  return (await getSodium()).from_base64(text);
}

function encode(link: ChainLink, content: MessageContent): Uint8Array {
  return encoder.encode(JSON.stringify({ ...link, ...content }));
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

export function matchesLastGroup(code: Uint8Array, input: string): boolean {
  return input.trim().toUpperCase() === lastGroup(code);
}

export async function submitReport(
  api: ReportApi,
  code: Uint8Array,
  content: ReportContent,
  tenantPk: string,
): Promise<void> {
  const keys = await deriveCaseKeys(code);
  const link = await createChainLink('reporter');
  const sealed = await sealReport(encode(link, content), keys, await fromBase64(tenantPk));
  await api.report.submit({
    lookupId: await toBase64(sealed.lookupId),
    envelope: await toBase64(sealed.envelope),
    report: await toBase64(sealed.report),
  });
}

async function readMessage(stored: StoredMessage, caseKey: Uint8Array): Promise<CaseMessage> {
  const ciphertext = await fromBase64(stored.ciphertext);
  const json: unknown = JSON.parse(decoder.decode(await decryptMessage(ciphertext, caseKey)));
  const link = parseChainLink(json);
  const { text, category } = json as MessageContent & { category?: unknown };
  return {
    id: stored.id,
    createdAt: stored.createdAt,
    ciphertext,
    link,
    role: link.role,
    text,
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
): Promise<void> {
  const { lookupId, caseKey } = await deriveCaseKeys(code);
  const link = await createChainLink('reporter', previous);
  await api.case.postMessage({
    lookupId: await toBase64(lookupId),
    ciphertext: await toBase64(await encryptMessage(encode(link, { text }), caseKey)),
    meetingRequest,
  });
}
