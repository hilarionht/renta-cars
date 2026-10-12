// Espejo de reservations/reservations-hooks.ts (mismo patron React Query), pero via
// customerApiRequest (no apiRequest de staff) contra /api/v1/me/reservations*. Query keys
// con prefijo propio ('me-reservations', nunca 'reservations') - sin colision real (React
// Query compara arrays por valor), pero deja claro a que flujo de auth pertenece cada cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateMyReservationRequest,
  CreateMyReservationResponse,
  ReservationSummary,
} from '@frontend/domain-types';

import { customerApiRequest } from '../customer-auth/customer-api-client';

const LIST_KEY = ['me-reservations', 'list'] as const;
const detailKey = (id: string) => ['me-reservations', 'detail', id] as const;

export function useMyReservations() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => customerApiRequest<ReservationSummary[]>('/api/v1/me/reservations'),
  });
}

export function useMyReservation(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => customerApiRequest<ReservationSummary>(`/api/v1/me/reservations/${id}`),
  });
}

export function useCreateMyReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMyReservationRequest) =>
      customerApiRequest<CreateMyReservationResponse>('/api/v1/me/reservations', {
        method: 'POST',
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useCancelMyReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      customerApiRequest<void>(`/api/v1/me/reservations/${reservationId}/cancel`, {
        method: 'POST',
      }),
    onSuccess: async (_data, reservationId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: detailKey(reservationId) }),
      ]);
    },
  });
}
