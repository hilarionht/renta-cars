'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ApiError } from '@frontend/data-access-core';
import type {
  AuditLogEntry,
  BranchSummary,
  Company,
  CompanySettings,
  PermissionKey,
  Role,
  StaffUser,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';

// docs/persistence/10-DECISIONES.md #140: consultas del modulo Administracion de la web. Leer es
// libre para el personal (salvo la auditoria, audit:read); las acciones van por permiso.
export const USERS_QUERY_KEY = ['users'] as const;
export const ROLES_QUERY_KEY = ['roles'] as const;
export const COMPANY_QUERY_KEY = ['company'] as const;
export const COMPANY_SETTINGS_QUERY_KEY = ['company-settings'] as const;
export const AUDIT_LOG_QUERY_KEY = ['audit-log'] as const;
export const userQueryKey = (id: string) => ['users', 'detail', id] as const;
export const branchQueryKey = (id: string) => ['branches', 'detail', id] as const;

const PAGE_SIZE = 50;

export function useUsers() {
  const { api } = useWebAuth();
  return useInfiniteQuery({
    queryKey: [...USERS_QUERY_KEY, 'list'],
    queryFn: ({ pageParam }) =>
      api.requestPage<StaffUser>('/api/v1/users', {
        query: { limit: PAGE_SIZE, cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
  });
}

export function useUser(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: userQueryKey(id),
    queryFn: () => api.request<StaffUser>(`/api/v1/users/${id}`),
  });
}

// Nombre de un actor de la auditoria. "system" (procesos) y un usuario que ya no se encuentra
// (404) no son errores: se muestran tal cual.
export function useActorName(actorRef: string) {
  const { api } = useWebAuth();
  const isUser = actorRef !== 'system';
  return useQuery({
    queryKey: [...userQueryKey(actorRef), 'name'],
    queryFn: async () => {
      try {
        return (await api.request<StaffUser>(`/api/v1/users/${actorRef}`)).name;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
          return null;
        }
        throw error;
      }
    },
    enabled: isUser,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useRoles() {
  const { status, api } = useWebAuth();
  return useQuery({
    queryKey: [...ROLES_QUERY_KEY, 'list'],
    queryFn: () => api.request<Role[]>('/api/v1/roles'),
    enabled: status === 'authenticated',
  });
}

export function usePermissionCatalog() {
  const { status, api } = useWebAuth();
  return useQuery({
    queryKey: ['permission-catalog'],
    queryFn: async () =>
      (await api.request<PermissionKey[]>('/api/v1/permissions')).map((item) => item.key),
    enabled: status === 'authenticated',
    staleTime: Infinity,
  });
}

export function useBranch(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: branchQueryKey(id),
    queryFn: () => api.request<BranchSummary>(`/api/v1/branches/${id}`),
  });
}

export function useCompany() {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: COMPANY_QUERY_KEY,
    queryFn: () => api.request<Company>('/api/v1/companies'),
  });
}

export function useCompanySettings() {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: () => api.request<CompanySettings>('/api/v1/company-settings'),
  });
}

export interface AuditLogFilters {
  subjectType?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

export function useAuditLog(filters: AuditLogFilters, enabled = true) {
  const { api } = useWebAuth();
  return useInfiniteQuery({
    queryKey: [...AUDIT_LOG_QUERY_KEY, filters],
    queryFn: ({ pageParam }) =>
      api.requestPage<AuditLogEntry>('/api/v1/audit-log', {
        query: { ...filters, limit: PAGE_SIZE, cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}
