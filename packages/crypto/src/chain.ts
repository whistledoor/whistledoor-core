import { getSodium } from './sodium.js';

// crypto-design.md section 5, message chain. The fields live inside each
// message's encrypted JSON; this module builds and checks them.

/** Length of `prev` before encoding: crypto_generichash(32, …). */
export const MESSAGE_HASH_BYTES = 32;

/** base64url without padding of 32 bytes: 43 characters, the last one carrying 2 zero bits. */
const ENCODED_HASH = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export type MessageRole = 'reporter' | 'handler';

/** The chain fields of a message's JSON. The report is `seq` 0 without `prev`. */
export interface ChainLink {
  seq: number;
  /** crypto_generichash(32) of the previous message's stored ciphertext, base64url without padding. */
  prev?: string;
  role: MessageRole;
}

/** A stored message together with the chain fields read from its decrypted JSON. */
export interface ChainedMessage {
  ciphertext: Uint8Array;
  link: ChainLink;
}

export type ChainLinkErrorReason = 'shape' | 'seq' | 'prev' | 'role';

/** Thrown when decrypted JSON does not carry valid chain fields. */
export class ChainLinkError extends Error {
  readonly reason: ChainLinkErrorReason;

  constructor(reason: ChainLinkErrorReason, message: string) {
    super(message);
    this.name = 'ChainLinkError';
    this.reason = reason;
  }
}

/**
 * What the client warns about:
 * - `missing-report`: the first message is not `seq` 0.
 * - `extra-report`: a later message claims `seq` 0.
 * - `unknown-prev`: `prev` matches no message of the case (a message was removed or is foreign).
 * - `wrong-seq`: `seq` is not the `seq` of `prev` plus one.
 * - `duplicate`: the same stored ciphertext appears again; it is left out of `ordered`.
 */
export type ChainIssueKind = 'missing-report' | 'extra-report' | 'unknown-prev' | 'wrong-seq' | 'duplicate';

export interface ChainIssue {
  kind: ChainIssueKind;
  /** Index into the messages passed to `checkChain`. */
  index: number;
}

export interface ChainCheck<T extends ChainedMessage> {
  /** Messages ordered by `seq`, ties in the order given (time). Duplicates are left out. */
  ordered: T[];
  /** Empty when the chain is intact. */
  issues: ChainIssue[];
}

/** `crypto_generichash(32, ciphertext)` as base64url without padding: the `prev` of the next message. */
export async function messageHash(ciphertext: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(
    sodium.crypto_generichash(MESSAGE_HASH_BYTES, ciphertext, null),
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
}

/**
 * Chain fields for a new message. Without `previous` it is the report (`seq` 0).
 * Otherwise `previous` is the newest message the writer has seen.
 */
export async function createChainLink(role: MessageRole, previous?: ChainedMessage): Promise<ChainLink> {
  if (!previous) {
    return { seq: 0, role };
  }
  return { seq: previous.link.seq + 1, prev: await messageHash(previous.ciphertext), role };
}

/** Reads the chain fields from a message's decrypted JSON. Other fields are ignored. */
export function parseChainLink(value: unknown): ChainLink {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ChainLinkError('shape', 'Message JSON must be an object');
  }
  const { seq, prev, role } = value as Record<string, unknown>;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0) {
    throw new ChainLinkError('seq', 'seq must be a non-negative integer');
  }
  if (role !== 'reporter' && role !== 'handler') {
    throw new ChainLinkError('role', 'role must be "reporter" or "handler"');
  }
  if (seq === 0) {
    if (prev !== undefined) {
      throw new ChainLinkError('prev', 'The report (seq 0) has no prev');
    }
    return { seq, role };
  }
  if (typeof prev !== 'string' || !ENCODED_HASH.test(prev)) {
    throw new ChainLinkError('prev', 'prev must be a 32-byte hash in base64url without padding');
  }
  return { seq, prev, role };
}

/**
 * Checks a case's messages, the report first, the rest in the order the
 * server returned them. Forks (two messages with the same `prev`) are not
 * an issue. Removing the newest messages cannot be detected here.
 */
export async function checkChain<T extends ChainedMessage>(messages: readonly T[]): Promise<ChainCheck<T>> {
  const hashes = await Promise.all(messages.map((message) => messageHash(message.ciphertext)));
  const firstIndex = new Map<string, number>();
  const issues: ChainIssue[] = [];
  const kept: number[] = [];

  hashes.forEach((hash, index) => {
    if (firstIndex.has(hash)) {
      issues.push({ kind: 'duplicate', index });
    } else {
      firstIndex.set(hash, index);
      kept.push(index);
    }
  });

  for (const index of kept) {
    const link = messages[index]!.link;
    if (index === 0 && link.seq !== 0) {
      issues.push({ kind: 'missing-report', index });
    }
    if (link.seq === 0) {
      if (index !== 0) {
        issues.push({ kind: 'extra-report', index });
      }
      continue;
    }
    const prevIndex = link.prev === undefined ? undefined : firstIndex.get(link.prev);
    if (prevIndex === undefined || prevIndex === index) {
      issues.push({ kind: 'unknown-prev', index });
    } else if (messages[prevIndex]!.link.seq + 1 !== link.seq) {
      issues.push({ kind: 'wrong-seq', index });
    }
  }

  issues.sort((a, b) => a.index - b.index);
  const ordered = kept
    .slice()
    .sort((a, b) => messages[a]!.link.seq - messages[b]!.link.seq || a - b)
    .map((index) => messages[index]!);
  return { ordered, issues };
}
