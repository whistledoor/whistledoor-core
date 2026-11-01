import { oc } from '@orpc/contract';
import type { ContractRouterClient } from '@orpc/contract';
import { z } from 'zod';

// docs/report-app.md, section API. Binary fields are base64url without padding,
// except files, which go as multipart.
// Nothing here is plaintext: the server sees only what these schemas carry.

const bytes = z.base64url();
/** crypto_kdf output, 32 bytes: 43 characters. */
const lookupId = bytes.length(43);
/** The objects a report or message uses, in clear, so the server can clean up and enforce limits. */
const fileIds = z.array(z.string());

export const caseStatus = z.enum(['new', 'acknowledged', 'in_progress', 'closed']);
export type CaseStatus = z.infer<typeof caseStatus>;

export const language = z.enum(['de', 'en']);
export type Language = z.infer<typeof language>;

const tenant = z.object({
  name: z.string(),
  tenantPk: bytes,
  handlers: z.array(z.string()),
  defaultLanguage: language.optional(),
  /** False for an expired trial or an unpaid account: no new reports, existing cases still open. */
  active: z.boolean(),
});
export type Tenant = z.infer<typeof tenant>;

const message = z.object({
  id: z.string(),
  ciphertext: bytes,
  createdAt: z.iso.datetime(),
});
export type StoredMessage = z.infer<typeof message>;

const openedCase = z.object({
  status: caseStatus,
  report: message,
  messages: z.array(message),
});
export type OpenedCase = z.infer<typeof openedCase>;

export const contract = {
  tenant: {
    /** The tenant comes from the request's hostname. */
    get: oc.output(tenant),
  },
  report: {
    submit: oc
      .input(z.object({ lookupId, envelope: bytes, report: bytes, fileIds }))
      .output(z.object({ createdAt: z.iso.datetime() })),
  },
  case: {
    open: oc.input(z.object({ lookupId })).output(openedCase),
    postMessage: oc
      .input(z.object({ lookupId, ciphertext: bytes, meetingRequest: z.boolean(), fileIds }))
      .output(z.object({ id: z.string() })),
  },
  /**
   * Opaque objects, crypto-design.md section 6. Names, types and keys live only
   * inside the encrypted report or message JSON.
   *
   * Upload comes first, then the report or message that lists the ids in
   * `fileIds`. So `upload` must accept a `lookupId` with no case yet, within a
   * quota. The server deletes uploads that no report or message lists after a
   * while, and enforces the per-message limit from `fileIds`.
   */
  file: {
    upload: oc.input(z.object({ lookupId, ciphertext: z.file() })).output(z.object({ id: z.string() })),
    download: oc.input(z.object({ lookupId, id: z.string() })).output(z.file()),
  },
};

export type ReportApi = ContractRouterClient<typeof contract>;
