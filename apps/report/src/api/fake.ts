import { ORPCError } from '@orpc/client';
import { generateKeyPair, getSodium } from '@whistledoor/crypto';
import type { OpenedCase, ReportApi, StoredMessage, Tenant } from '@whistledoor/api-contract';

/** In-memory stand-in for the private API, for `vite dev` and tests. */
export function createFakeApi(tenant: Partial<Tenant> = {}): ReportApi {
  const cases = new Map<string, OpenedCase>();
  const tenantPk = generateKeyPair().then(async (pair) => (await getSodium()).to_base64(pair.publicKey));
  let nextId = 0;

  const store = (ciphertext: string): StoredMessage => ({
    id: String(nextId++),
    ciphertext,
    createdAt: new Date().toISOString(),
  });

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
        handlers: ['Anna Berger', 'Peter Huber'],
        defaultLanguage: 'de',
        active: true,
        ...tenant,
      }),
    },
    report: {
      submit: async ({ lookupId, report }) => {
        const stored = store(report);
        cases.set(lookupId, { status: 'new', report: stored, messages: [] });
        return { createdAt: stored.createdAt };
      },
    },
    case: {
      open: async ({ lookupId }) => find(lookupId),
      postMessage: async ({ lookupId, ciphertext }) => {
        const stored = store(ciphertext);
        find(lookupId).messages.push(stored);
        return { id: stored.id };
      },
    },
  };
}
