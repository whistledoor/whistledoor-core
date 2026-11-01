import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Tenant } from '@whistledoor/api-contract';
import { api } from './client';

export function useTenant(): UseQueryResult<Tenant> {
  return useQuery({ queryKey: ['tenant'], queryFn: () => api.tenant.get(), staleTime: Infinity });
}
