'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  ChangePasswordRequest,
  CreateBranchRequest,
  CreateRoleRequest,
  CreateUserRequest,
  DisableUserRequest,
  EditRolePermissionsRequest,
  SettingsPolicy,
  SettingsPolicyRequests,
  UpdateBranchRequest,
  UpdateCompanyRequest,
  UpdateUserRequest,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';
import { CURRENT_USER_QUERY_KEY } from '../current-user';
import {
  AUDIT_LOG_QUERY_KEY,
  COMPANY_QUERY_KEY,
  COMPANY_SETTINGS_QUERY_KEY,
  ROLES_QUERY_KEY,
  USERS_QUERY_KEY,
} from './queries';

// docs/persistence/10-DECISIONES.md #140. Mismo criterio que fleet/ y customers/: cada accion
// invalida tambien ante error (un 409 recarga el estado real) y la auditoria, que suma una entrada.
function useInvalidate(keys: readonly (readonly string[])[]) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [...keys, AUDIT_LOG_QUERY_KEY].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

// --- usuarios
export type UserActionInput =
  | { action: 'update'; body: UpdateUserRequest }
  | { action: 'disable'; body: DisableUserRequest }
  | { action: 'reactivate' }
  | { action: 'change-password'; body: ChangePasswordRequest }
  | { action: 'assign-role'; roleId: string }
  | { action: 'revoke-role'; roleId: string };

export function userActionRequest(
  userId: string,
  input: UserActionInput,
): { path: string; method: 'POST' | 'PATCH'; body?: unknown } {
  const base = `/api/v1/users/${userId}`;
  switch (input.action) {
    case 'update':
      return { path: base, method: 'PATCH', body: input.body };
    case 'assign-role':
    case 'revoke-role':
      return { path: `${base}/${input.action}`, method: 'POST', body: { roleId: input.roleId } };
    case 'reactivate':
      return { path: `${base}/reactivate`, method: 'POST' };
    default:
      return { path: `${base}/${input.action}`, method: 'POST', body: input.body };
  }
}

export function useUserAction(userId: string) {
  const { api } = useWebAuth();
  // Los cambios de uno mismo (roles, nombre) se reflejan en /users/me.
  const invalidate = useInvalidate([USERS_QUERY_KEY, CURRENT_USER_QUERY_KEY]);
  return useMutation({
    mutationFn: (input: UserActionInput) => {
      const { path, method, body } = userActionRequest(userId, input);
      return api.request<unknown>(path, { method, body });
    },
    onSettled: invalidate,
  });
}

export function useCreateUser() {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([USERS_QUERY_KEY]);
  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      api.request<{ id: string }>('/api/v1/users', { method: 'POST', body }),
    onSettled: invalidate,
  });
}

// --- roles
export type RoleActionInput =
  { action: 'edit-permissions'; body: EditRolePermissionsRequest } | { action: 'deactivate' };

export function useRoleAction(roleId: string) {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([ROLES_QUERY_KEY, CURRENT_USER_QUERY_KEY]);
  return useMutation({
    mutationFn: (input: RoleActionInput) =>
      input.action === 'edit-permissions'
        ? api.request<unknown>(`/api/v1/roles/${roleId}/permissions`, {
            method: 'PATCH',
            body: input.body,
          })
        : api.request<unknown>(`/api/v1/roles/${roleId}/deactivate`, { method: 'POST' }),
    onSettled: invalidate,
  });
}

export function useCreateRole() {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([ROLES_QUERY_KEY]);
  return useMutation({
    mutationFn: (body: CreateRoleRequest) =>
      api.request<{ id: string }>('/api/v1/roles', { method: 'POST', body }),
    onSettled: invalidate,
  });
}

// --- sucursales (comparten la clave ['branches'] con useBranches de reservas)
export type BranchActionInput =
  { action: 'update'; body: UpdateBranchRequest } | { action: 'close' } | { action: 'reopen' };

export function useBranchAction(branchId: string) {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([['branches']]);
  return useMutation({
    mutationFn: (input: BranchActionInput) =>
      input.action === 'update'
        ? api.request<unknown>(`/api/v1/branches/${branchId}`, {
            method: 'PATCH',
            body: input.body,
          })
        : api.request<unknown>(`/api/v1/branches/${branchId}/${input.action}`, {
            method: 'POST',
          }),
    onSettled: invalidate,
  });
}

export function useCreateBranch() {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([['branches']]);
  return useMutation({
    mutationFn: (body: CreateBranchRequest) =>
      api.request<{ id: string }>('/api/v1/branches', { method: 'POST', body }),
    onSettled: invalidate,
  });
}

// --- empresa y configuracion
export function useUpdateCompany() {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([COMPANY_QUERY_KEY]);
  return useMutation({
    mutationFn: (body: UpdateCompanyRequest) =>
      api.request<unknown>('/api/v1/companies', { method: 'PATCH', body }),
    onSettled: invalidate,
  });
}

export function useUpdateSettingsPolicy<P extends SettingsPolicy>(policy: P) {
  const { api } = useWebAuth();
  const invalidate = useInvalidate([COMPANY_SETTINGS_QUERY_KEY]);
  return useMutation({
    mutationFn: (body: SettingsPolicyRequests[P]) =>
      api.request<unknown>(`/api/v1/company-settings/${policy}`, { method: 'PATCH', body }),
    onSettled: invalidate,
  });
}
