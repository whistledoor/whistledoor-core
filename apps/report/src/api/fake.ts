import { ORPCError } from '@orpc/client';
import { generateKeyPair, getSodium } from '@whistledoor/crypto';
import type { OpenedCase, ReportApi, StoredMessage, Tenant } from '@whistledoor/api-contract';

/** In-memory stand-in for the private API, for `vite dev` and tests. */
export function createFakeApi(tenant: Partial<Tenant> = {}): ReportApi {
  const cases = new Map<string, OpenedCase>();
  const files = new Map<string, { lookupId: string; ciphertext: File }>();
  const tenantPk = generateKeyPair().then(async (pair) => (await getSodium()).to_base64(pair.publicKey));
  let nextId = 0;

  const store = (ciphertext: string): StoredMessage => ({
    id: String(nextId++),
    ciphertext,
    createdAt: new Date().toISOString(),
  });

  const assertOwnFiles = (lookupId: string, fileIds: readonly string[]): void => {
    if (fileIds.some((id) => files.get(id)?.lookupId !== lookupId)) {
      throw new ORPCError('BAD_REQUEST');
    }
  };

  const find = (lookupId: string): OpenedCase => {
    const found = cases.get(lookupId);
    if (!found) {
      throw new ORPCError('NOT_FOUND');
    }
    return found;
  };

  return {
    tenant: {
      get: async () => ({
        name: 'Musterfirma GmbH',
        tenantPk: await tenantPk,
        branding: {
          // Served by `vite dev` from the source tree, so it stays out of the bundle.
          logoUrl: '/src/api/fake-logo.svg',
          primaryColor: '#0f766e',
          intro: {
            de: 'Bei der Musterfirma können Sie hier auf Missstände hinweisen, anonym und verschlüsselt.',
            en: 'Use this channel to tell Musterfirma about wrongdoing, anonymously and encrypted.',
          },
        },
        handlers: ['Anna Berger', 'Peter Huber'],
        defaultLanguage: 'de',
        active: true,
        ...tenant,
      }),
    },
    report: {
      submit: async ({ lookupId, report, fileIds }) => {
        assertOwnFiles(lookupId, fileIds);
        const stored = store(report);
        cases.set(lookupId, { status: 'new', report: stored, messages: [] });
        return { createdAt: stored.createdAt };
      },
    },
    case: {
      open: async ({ lookupId }) => find(lookupId),
      postMessage: async ({ lookupId, ciphertext, fileIds }) => {
        assertOwnFiles(lookupId, fileIds);
        const stored = store(ciphertext);
        find(lookupId).messages.push(stored);
        return { id: stored.id };
      },
    },
    file: {
      // No case check: files are uploaded before the report that references them.
      upload: async ({ lookupId, ciphertext }) => {
        const id = String(nextId++);
        files.set(id, { lookupId, ciphertext });
        return { id };
      },
      download: async ({ lookupId, id }) => {
        const found = files.get(id);
        if (found?.lookupId !== lookupId) {
          throw new ORPCError('NOT_FOUND');
        }
        return found.ciphertext;
      },
    },
  };
}
