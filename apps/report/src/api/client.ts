import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ReportApi } from '@whistledoor/api-contract';
import { createFakeApi } from './fake';

// Same origin only, so the CSP can stay at connect-src 'self'. The fake never
// reaches a production build: this branch is removed as dead code.
export const api: ReportApi = import.meta.env.DEV
  ? createFakeApi()
  : createORPCClient(new RPCLink({ url: `${window.location.origin}/api` }));
