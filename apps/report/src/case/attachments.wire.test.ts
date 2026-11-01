import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { StandardRPCJsonSerializer, StandardRPCSerializer } from '@orpc/client/standard';
import { describe, expect, it } from 'vitest';
import { contract } from '@whistledoor/api-contract';
import type { ReportApi } from '@whistledoor/api-contract';
import { formatCaseCode, generateCaseCode } from '@whistledoor/crypto';
import { createFakeApi } from '../api/fake';
import { downloadAttachment } from './attachments';
import { openCase, postMessage, submitReport } from './case';
import type { ReportContent } from './case';

// Runs the real oRPC client over its real encoding, with the contract's schemas
// on the far side. A File inside JSON.stringify is `{}`, so only the bytes of the
// requests show what leaves the browser.

const FILE_NAME = 'Vertrag-Mustermann.pdf';
const FILE_TYPE = 'application/x-geheim';
const CONTENT = 'Inhalt-der-Datei-im-Klartext';

const report: ReportContent = { kind: 'anonymous', category: 'fraud', text: 'Geheimer Hinweis' };
const file = { name: FILE_NAME, type: FILE_TYPE, data: new TextEncoder().encode(CONTENT) };

interface Schema {
  parse: (value: unknown) => unknown;
}
type Procedures = Record<string, Record<string, unknown>>;

const serializer = new StandardRPCSerializer(new StandardRPCJsonSerializer());

function createRpcApi(): { api: ReportApi; requests: Uint8Array[] } {
  const fake = createFakeApi();
  const requests: Uint8Array[] = [];
  const link = new RPCLink({
    url: 'http://report.test/api',
    fetch: async (request) => {
      requests.push(new Uint8Array(await request.clone().arrayBuffer()));
      const [group, name] = new URL(request.url).pathname.split('/').slice(-2) as [string, string];
      const handler = (fake as unknown as Procedures)[group]![name] as (input: unknown) => Promise<unknown>;
      const { '~orpc': schemas } = (contract as unknown as Procedures)[group]![name] as {
        '~orpc': { inputSchema?: Schema; outputSchema: Schema };
      };
      const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
      const input = serializer.deserialize(multipart ? await request.formData() : await request.json());
      const output = schemas.outputSchema.parse(await handler(schemas.inputSchema?.parse(input)));
      const body = serializer.serialize(output);
      return body instanceof FormData ? new Response(body) : Response.json(body);
    },
  });
  return { api: createORPCClient(link), requests };
}

async function sendReport() {
  const { api, requests } = createRpcApi();
  const code = await generateCaseCode();
  const { tenantPk } = await api.tenant.get();
  await submitReport(api, code, report, tenantPk, [file]);
  return { api, code, requests };
}

const wire = (requests: Uint8Array[]): string =>
  requests.map((request) => new TextDecoder('latin1').decode(request)).join('\n');

describe('attachments over oRPC', () => {
  it('carries a file both ways', async () => {
    const { api, code } = await sendReport();

    const { messages } = await openCase(api, code);

    expect(await downloadAttachment(api, code, messages[0]!.attachments[0]!)).toEqual(file.data);
  });

  it('uploads with a neutral name and type', async () => {
    const { requests } = await sendReport();

    expect(wire(requests)).toContain('filename="blob"');
    expect(wire(requests)).toContain('application/octet-stream');
  });

  it('sends neither name, type, content, text nor code', async () => {
    const { code, requests } = await sendReport();
    const sent = wire(requests);

    expect(sent).not.toContain(FILE_NAME);
    expect(sent).not.toContain(FILE_TYPE);
    expect(sent).not.toContain(CONTENT);
    expect(sent).not.toContain('Geheimer Hinweis');
    expect(sent).not.toContain(formatCaseCode(code).replaceAll('-', ''));
  });

  it('sends neither the file key nor the stream header', async () => {
    const { api, code, requests } = await sendReport();
    const sent = wire(requests);

    const { messages } = await openCase(api, code);
    const { fileKey, header } = messages[0]!.attachments[0]!;

    expect(sent).not.toContain(fileKey);
    expect(sent).not.toContain(header);
  });

  it('holds for a reply too', async () => {
    const { api, code, requests } = await sendReport();
    const { messages } = await openCase(api, code);
    requests.length = 0;

    await postMessage(api, code, 'Nachtrag', messages[0]!, false, [file]);

    expect(requests).toHaveLength(2);
    expect(wire(requests)).not.toContain(FILE_NAME);
    expect(wire(requests)).not.toContain(CONTENT);
  });
});
