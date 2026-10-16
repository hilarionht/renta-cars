'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  ApproveExtensionRequest,
  CheckInReservationRequest,
  CheckOutReservationRequest,
  CreateReservationRequest,
  RequestExtensionRequest,
  RescheduleReservationRequest,
  SwapVehicleRequest,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';
import { RESERVATIONS_QUERY_KEY } from './queries';

// docs/persistence/10-DECISIONES.md #135. Cada accion invalida listados y detalle al terminar,
// salga bien o mal: ante un 409 CONCURRENT_MODIFICATION (otro usuario la cambio) la pantalla
// se recarga con el estado real y el usuario decide de nuevo.
export type ReservationActionInput =
  | { action: 'confirm' }
  | { action: 'cancel' }
  | { action: 'mark-no-show' }
  | { action: 'check-out'; body: CheckOutReservationRequest }
  | { action: 'check-in'; body: CheckInReservationRequest }
  | { action: 'reschedule'; body: RescheduleReservationRequest }
  | { action: 'request-extension'; body: RequestExtensionRequest }
  | { action: 'approve-extension'; body: ApproveExtensionRequest }
  | { action: 'swap-vehicle'; body: SwapVehicleRequest };

export type ReservationAction = ReservationActionInput['action'];

export function useReservationAction(reservationId: string) {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReservationActionInput) =>
      api.request<void>(`/api/v1/reservations/${reservationId}/${input.action}`, {
        method: 'POST',
        body: 'body' in input ? input.body : undefined,
      }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices', 'by-reservation', reservationId] }),
      ]);
    },
  });
}

export function useCreateReservation() {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservationRequest) =>
      api.request<{ id: string }>('/api/v1/reservations', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
  });
}
