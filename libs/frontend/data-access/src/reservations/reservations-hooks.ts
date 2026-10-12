// docs/06-CONVENCIONES-FRONTEND.md SS5/SS6: server state = React Query, un hook por
// Bounded Context/caso de uso. Primer consumidor real de @tanstack/react-query en el repo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CheckInReservationRequest,
  CheckOutReservationRequest,
  ReservationSummary,
} from '@frontend/domain-types';

import { apiRequest } from '../auth/api-client';

const CHECK_OUT_LIST_KEY = ['reservations', 'to-check-out'] as const;
const CHECK_IN_LIST_KEY = ['reservations', 'to-check-in'] as const;

// GET /reservations?status=Confirmed - listas/search-reservations.handler.ts.
export function useReservationsToCheckOut() {
  return useQuery({
    queryKey: CHECK_OUT_LIST_KEY,
    queryFn: () => apiRequest<ReservationSummary[]>('/api/v1/reservations?status=Confirmed'),
  });
}

export function useReservationsToCheckIn() {
  return useQuery({
    queryKey: CHECK_IN_LIST_KEY,
    queryFn: () => apiRequest<ReservationSummary[]>('/api/v1/reservations?status=CheckedOut'),
  });
}

// POST /reservations/:id/check-out - mueve la reserva de "para retirar" a "para devolver",
// invalida ambas listas.
export function useCheckOutReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      body,
    }: {
      reservationId: string;
      body: CheckOutReservationRequest;
    }) =>
      apiRequest<void>(`/api/v1/reservations/${reservationId}/check-out`, {
        method: 'POST',
        body,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CHECK_OUT_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: CHECK_IN_LIST_KEY }),
      ]);
    },
  });
}

// POST /reservations/:id/check-in - saca la reserva de "para devolver" (pasa a CheckedIn,
// fuera del alcance de operador de sucursal en Fase 5).
export function useCheckInReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      body,
    }: {
      reservationId: string;
      body: CheckInReservationRequest;
    }) =>
      apiRequest<void>(`/api/v1/reservations/${reservationId}/check-in`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHECK_IN_LIST_KEY }),
  });
}
