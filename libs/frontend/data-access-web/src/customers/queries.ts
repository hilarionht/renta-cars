'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { CustomerDetail, CustomerListItem, ReservationListItem } from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';

// docs/persistence/10-DECISIONES.md #139: consultas del modulo Clientes de la web. El listado
// busca en el servidor (q) y pagina por cursor (#135).
export const CUSTOMERS_QUERY_KEY = ['customers'] as const;
export const customerQueryKey = (id: string) => ['customers', 'detail', id] as const;

const PAGE_SIZE = 25;
// Tope del API (ListReservationsRequestDto). Un cliente con mas reservas activas que esto
// es un caso que hoy no existe; si pasara, el aviso mostraria las primeras 100.
const ACTIVE_RESERVATIONS_LIMIT = 100;

export function useCustomers(q: string) {
  const { api } = useWebAuth();
  const trimmed = q.trim();
  return useInfiniteQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, 'list', trimmed],
    queryFn: ({ pageParam }) =>
      api.requestPage<CustomerListItem>('/api/v1/customers', {
        query: { q: trimmed || undefined, limit: PAGE_SIZE, cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: customerQueryKey(id),
    queryFn: () => api.request<CustomerDetail>(`/api/v1/customers/${id}`),
  });
}

// Reservas Confirmed y CheckedOut del cliente: las que afecta bloquearlo o revocar un
// conductor (#139, D). El listado filtra un solo estado, por eso son dos llamadas. Un usuario
// de sucursal solo ve las de su sucursal (el API usa la del token): gap anotado en #139.
export function useCustomerActiveReservations(customerId: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: ['reservations', 'active-by-customer', customerId],
    queryFn: async () => {
      const pages = await Promise.all(
        (['Confirmed', 'CheckedOut'] as const).map((status) =>
          api.requestPage<ReservationListItem>('/api/v1/reservations', {
            query: {
              customerId,
              status,
              expand: 'vehicle',
              limit: ACTIVE_RESERVATIONS_LIMIT,
            },
          }),
        ),
      );
      return pages
        .flatMap((page) => page.data)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    },
  });
}
