'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  VehicleCategoryDetail,
  VehicleCategoryRef,
  VehicleDetail,
  VehicleSummary,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';

// docs/persistence/10-DECISIONES.md #137: consultas del modulo Flota de la web. GET /vehicles no
// se pagina (catalogo chico); los filtros de estado derivado y patente se aplican en el
// cliente. El API agrega activeReservation porque el token es del personal.
export const VEHICLES_QUERY_KEY = ['vehicles'] as const;
export const VEHICLE_CATEGORIES_QUERY_KEY = ['vehicle-categories'] as const;
export const vehicleQueryKey = (id: string) => ['vehicles', 'detail', id] as const;
export const vehicleCategoryQueryKey = (id: string) =>
  ['vehicle-categories', 'detail', id] as const;

export function useVehicles(filters: { branchId?: string }) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, 'list', filters],
    queryFn: () =>
      api.request<VehicleSummary[]>('/api/v1/vehicles', {
        query: { branchId: filters.branchId, expand: 'vehicleCategory' },
      }),
  });
}

export function useVehicle(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: vehicleQueryKey(id),
    queryFn: () => api.request<VehicleDetail>(`/api/v1/vehicles/${id}`),
  });
}

export function useVehicleCategories() {
  const { status, api } = useWebAuth();
  return useQuery({
    queryKey: [...VEHICLE_CATEGORIES_QUERY_KEY, 'list'],
    queryFn: () => api.request<VehicleCategoryRef[]>('/api/v1/vehicle-categories'),
    enabled: status === 'authenticated',
    staleTime: 60 * 1000,
  });
}

export function useVehicleCategory(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: vehicleCategoryQueryKey(id),
    queryFn: () => api.request<VehicleCategoryDetail>(`/api/v1/vehicle-categories/${id}`),
  });
}
