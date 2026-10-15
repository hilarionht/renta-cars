'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  AddRateRequest,
  CompleteMaintenanceRequest,
  CreateVehicleCategoryRequest,
  MarkOutOfServiceRequest,
  RegisterVehicleRequest,
  ReportVehicleDamageRequest,
  ScheduleMaintenanceRequest,
  UploadVehicleDocumentRequest,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';
import { VEHICLE_CATEGORIES_QUERY_KEY, VEHICLES_QUERY_KEY } from './queries';

// docs/persistence/10-DECISIONES.md #137. Mismo criterio que reservations/mutations.ts: cada
// accion invalida tambien ante error (un 409 recarga el estado real). Ademas invalida las
// reservas: el estado de alquiler del vehiculo se lee de ellas.
export type VehicleActionInput =
  | { action: 'enable' }
  | { action: 'documents'; body: UploadVehicleDocumentRequest }
  | { action: 'verify-document'; documentId: string }
  | { action: 'maintenance'; body: ScheduleMaintenanceRequest }
  | { action: 'start-maintenance'; maintenanceId: string }
  | { action: 'complete-maintenance'; maintenanceId: string; body: CompleteMaintenanceRequest }
  | { action: 'report-damage'; body: ReportVehicleDamageRequest }
  | { action: 'mark-out-of-service'; body: MarkOutOfServiceRequest };

export type VehicleAction = VehicleActionInput['action'];

export function vehicleActionPath(vehicleId: string, input: VehicleActionInput): string {
  const base = `/api/v1/vehicles/${vehicleId}`;
  switch (input.action) {
    case 'verify-document':
      return `${base}/documents/${input.documentId}/verify`;
    case 'start-maintenance':
      return `${base}/maintenance/${input.maintenanceId}/start`;
    case 'complete-maintenance':
      return `${base}/maintenance/${input.maintenanceId}/complete`;
    default:
      return `${base}/${input.action}`;
  }
}

export function useVehicleAction(vehicleId: string) {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleActionInput) =>
      api.request<unknown>(vehicleActionPath(vehicleId, input), {
        method: 'POST',
        body: 'body' in input ? input.body : undefined,
      }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
      ]);
    },
  });
}

export function useRegisterVehicle() {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterVehicleRequest) =>
      api.request<{ id: string }>('/api/v1/vehicles', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

export function useCreateVehicleCategory() {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVehicleCategoryRequest) =>
      api.request<{ id: string }>('/api/v1/vehicle-categories', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: VEHICLE_CATEGORIES_QUERY_KEY }),
  });
}

export function useAddRate(categoryId: string) {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddRateRequest) =>
      api.request<{ id: string }>(`/api/v1/vehicle-categories/${categoryId}/rates`, {
        method: 'POST',
        body,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: VEHICLE_CATEGORIES_QUERY_KEY }),
  });
}
