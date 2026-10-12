'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { CurrentUser } from '@frontend/domain-types';

import { useWebAuth } from './auth-context';

// docs/persistence/10-DECISIONES.md #134: perfil + permisos efectivos (GET /users/me). Los
// permisos se usan SOLO para mostrar/ocultar UI - la autorizacion real la sigue haciendo el
// API en cada request (PermissionGuard).
export const CURRENT_USER_QUERY_KEY = ['current-user'] as const;

export function useCurrentUser() {
  const { status, api } = useWebAuth();
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => api.request<CurrentUser>('/api/v1/users/me'),
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

export interface Permissions {
  isLoading: boolean;
  has(permission: string): boolean;
  hasAny(permissions: readonly string[]): boolean;
  hasAnyWithPrefix(prefixes: readonly string[]): boolean;
}

export function buildPermissions(granted: readonly string[] | undefined, isLoading: boolean) {
  const set = new Set(granted ?? []);
  return {
    isLoading,
    has: (permission: string) => set.has(permission),
    hasAny: (permissions: readonly string[]) => permissions.some((p) => set.has(p)),
    hasAnyWithPrefix: (prefixes: readonly string[]) =>
      [...set].some((permission) => prefixes.some((prefix) => permission.startsWith(prefix))),
  } satisfies Permissions;
}

export function usePermissions(): Permissions {
  const { data, isLoading } = useCurrentUser();
  return buildPermissions(data?.permissions, isLoading);
}

// Renderiza children solo si el usuario tiene el permiso; si no, el fallback (por defecto nada).
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const permissions = usePermissions();
  return <>{permissions.has(permission) ? children : fallback}</>;
}
