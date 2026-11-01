import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Tenant } from '@whistledoor/api-contract';
import { isPosterOutdated, readPosterFingerprint } from '../case/poster';
import { api } from './client';

/** A tenant and the poster check on its `tenantPk`, so no key is used before it was checked. */
export type CheckedTenant = Tenant & { posterOutdated: boolean };

// Read once on load. App imports this module before the router, and the
// fragment goes no further than this file.
const posterFingerprint = readPosterFingerprint(window.location.hash);

export function useTenant(): UseQueryResult<CheckedTenant> {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const tenant = await api.tenant.get();
      return { ...tenant, posterOutdated: await isPosterOutdated(tenant.tenantPk, posterFingerprint) };
    },
    staleTime: Infinity,
  });
}
