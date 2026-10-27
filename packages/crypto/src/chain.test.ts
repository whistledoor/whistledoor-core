import { describe, expect, it } from 'vitest';
import type { ChainLink, ChainedMessage } from './chain.js';
import { ChainLinkError, checkChain, createChainLink, messageHash, parseChainLink } from './chain.js';
import { decryptMessage, encryptMessage } from './report.js';

// From vectors/chain.py, computed without libsodium: three messages under one
// case key, each `prev` being BLAKE2b-256 of the previous stored ciphertext.
const CASE_KEY = 'f6ee90222a799c412ff01ba08fe049d673627deedd995a29f78050da91991ff5';
const CHAIN = [
  {
    ciphertext:
      '017cb75bfc61dacafc1b79b71161386a0a5b5812116eb525334adbca2a130a90b98fb25823858f1e5ac8748c7afc8494e95b28725d14ea068c4a62aee73d0ed8d14683e17826fcb42581fa3c233bb7f9cbbdd1e0b6',
    hash: 'aHvAGUDBnrIGpxDOJADQ4-Oj_G0aOGbVKqnn7t4qW1g',
  },
  {
    ciphertext:
      '01066ffcc7237e126183a754d6a6bf57bb9da2ed48d6e76b0d19f4fe5cfb4c42e2fea84dd8cb1ef821998f22393d7fe8225fdd356a3c175a5a88acf89dd4957a5be6d736950ea459a18f2bb038d74f5777a3ad41f3e94d1de4d0709b99a6c0ed5ebc4c1b52e5cdbbf68e48c187c5e279844a1d48e56b38041e5b40cb919f11777f6046711fd525d706142a6752a2f1ea45145a2d6b00ac8668',
    hash: 'PZv5RZnc7M0sbZ2VNWRkx-cCDLU6hoyuNN6PvYJe-5s',
  },
  {
    ciphertext:
      '0190483fff229ec603badaec3a3cfdbefc5c7f90af67dc41c90faff997db4d3f738b4cd4e88605fbea4e89dca553912f95a9e256a318e1808435a30aefb7c6e76f4691fb7abe0567d9025d8030517fe00a7296124cf794286359c7f6551581b8ecff8ed4c76766c695228a56fa47ff45e40107531fcb2851f4ce7609bda2571a4a73afb4681ec5abe8327b0b62e4a98054e768',
    hash: 'uZBkLdYiDEBxAMf-NaWnOD2MPWclN3StyseLSsNQbNQ',
  },
];

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

/** Decrypts the vector chain and reads each message's chain fields. */
async function vectorMessages(): Promise<ChainedMessage[]> {
  return Promise.all(
    CHAIN.map(async ({ ciphertext }) => {
      const bytes = fromHex(ciphertext);
      const json: unknown = JSON.parse(new TextDecoder().decode(await decryptMessage(bytes, fromHex(CASE_KEY))));
      return { ciphertext: bytes, link: parseChainLink(json) };
    }),
  );
}

/** A message with arbitrary content; only its bytes and chain fields matter here. */
async function write(link: ChainLink, text: string): Promise<ChainedMessage> {
  const json = new TextEncoder().encode(JSON.stringify({ ...link, text }));
  return { ciphertext: await encryptMessage(json, fromHex(CASE_KEY)), link };
}

describe('messageHash', () => {
  it('matches the vector hashes', async () => {
    for (const { ciphertext, hash } of CHAIN) {
      expect(await messageHash(fromHex(ciphertext))).toBe(hash);
    }
  });
});

describe('vector chain', () => {
  it('decrypts to the expected chain fields', async () => {
    const links = (await vectorMessages()).map((message) => message.link);
    expect(links).toEqual([
      { seq: 0, role: 'reporter' },
      { seq: 1, prev: CHAIN[0]!.hash, role: 'handler' },
      { seq: 2, prev: CHAIN[1]!.hash, role: 'reporter' },
    ]);
  });

  it('is intact', async () => {
    const messages = await vectorMessages();
    expect(await checkChain(messages)).toEqual({ ordered: messages, issues: [] });
  });

  it('orders by seq whatever order the server returns', async () => {
    const [report, first, second] = await vectorMessages();
    const check = await checkChain([report!, second!, first!]);
    expect(check.issues).toEqual([]);
    expect(check.ordered).toEqual([report, first, second]);
  });
});

describe('createChainLink', () => {
  it('builds the report link and the links that follow it', async () => {
    const [report, first] = await vectorMessages();
    expect(await createChainLink('reporter')).toEqual({ seq: 0, role: 'reporter' });
    expect(await createChainLink('handler', report)).toEqual({ seq: 1, prev: CHAIN[0]!.hash, role: 'handler' });
    expect(await createChainLink('reporter', first)).toEqual({ seq: 2, prev: CHAIN[1]!.hash, role: 'reporter' });
  });

  it('builds a chain that checks out and survives JSON', async () => {
    const report = await write(await createChainLink('reporter'), 'Meldung');
    const reply = await write(await createChainLink('handler', report), 'Antwort');
    const parsed = parseChainLink(JSON.parse(JSON.stringify(reply.link)));
    expect(parsed).toEqual(reply.link);
    expect((await checkChain([report, reply])).issues).toEqual([]);
  });
});

describe('parseChainLink', () => {
  const prev = CHAIN[0]!.hash;

  it('keeps only the chain fields', () => {
    expect(parseChainLink({ seq: 1, prev, role: 'handler', text: 'x' })).toEqual({ seq: 1, prev, role: 'handler' });
  });

  it.each([
    ['shape', null],
    ['shape', 'text'],
    ['shape', [0]],
    ['seq', { role: 'reporter' }],
    ['seq', { seq: -1, role: 'reporter' }],
    ['seq', { seq: 1.5, prev, role: 'reporter' }],
    ['seq', { seq: '1', prev, role: 'reporter' }],
    ['seq', { seq: Number.MAX_SAFE_INTEGER + 1, prev, role: 'reporter' }],
    ['role', { seq: 0 }],
    ['role', { seq: 0, role: 'admin' }],
    ['prev', { seq: 0, prev, role: 'reporter' }],
    ['prev', { seq: 1, role: 'handler' }],
    ['prev', { seq: 1, prev: prev.slice(1), role: 'handler' }],
    ['prev', { seq: 1, prev: `${prev}=`, role: 'handler' }],
    ['prev', { seq: 1, prev: prev.replace('-', '+'), role: 'handler' }],
    ['prev', { seq: 1, prev: `${prev.slice(0, 42)}h`, role: 'handler' }],
  ])('rejects %s: %j', (reason, value) => {
    try {
      parseChainLink(value);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ChainLinkError);
      expect((error as ChainLinkError).reason).toBe(reason);
    }
  });
});

describe('checkChain issues', () => {
  it('accepts a fork and chains on from either branch', async () => {
    const [report] = await vectorMessages();
    const a = await write(await createChainLink('handler', report), 'Handler A');
    const b = await write(await createChainLink('reporter', report), 'Reporter');
    const next = await write(await createChainLink('handler', b), 'Handler B');
    const check = await checkChain([report!, a, next, b]);
    expect(check.issues).toEqual([]);
    expect(check.ordered).toEqual([report, a, b, next]);
  });

  it('reports a removed message as unknown-prev of its successor', async () => {
    const [report, , second] = await vectorMessages();
    expect((await checkChain([report!, second!])).issues).toEqual([{ kind: 'unknown-prev', index: 1 }]);
  });

  it('reports a wrong seq', async () => {
    const [report] = await vectorMessages();
    const skipped = await write({ seq: 2, prev: CHAIN[0]!.hash, role: 'handler' }, 'zu weit');
    expect((await checkChain([report!, skipped])).issues).toEqual([{ kind: 'wrong-seq', index: 1 }]);
  });

  it('reports a missing report and an extra one', async () => {
    const [report, first] = await vectorMessages();
    expect((await checkChain([first!, report!])).issues).toEqual([
      { kind: 'missing-report', index: 0 },
      { kind: 'extra-report', index: 1 },
    ]);
  });

  it('reports a replayed message once and leaves it out', async () => {
    const messages = await vectorMessages();
    const check = await checkChain([...messages, messages[1]!]);
    expect(check.issues).toEqual([{ kind: 'duplicate', index: 3 }]);
    expect(check.ordered).toEqual(messages);
  });

  it('reports nothing for an empty case and a lone report', async () => {
    const [report] = await vectorMessages();
    expect(await checkChain([])).toEqual({ ordered: [], issues: [] });
    expect((await checkChain([report!])).issues).toEqual([]);
  });
});
