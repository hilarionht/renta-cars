'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type {
  BranchSummary,
  CustomerListItem,
  InvoiceSummary,
  ReservationDetail,
  ReservationListItem,
  ReservationStatus,
  VehicleSummary,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';

// docs/persistence/10-DECISIONES.md #135: hooks de datos del modulo Reservas de la web. Viven
// en data-access-web (no en apps/web-admin, desviacion anotada de docs/06 SS6) porque usan
// la sesion del personal de #134; la logica sin plataforma (zona horaria) va en
// data-access-core.
export const RESERVATIONS_QUERY_KEY = ['reservations'] as const;
export const reservationQueryKey = (id: string) => ['reservations', 'detail', id] as const;

export interface ReservationFilters {
  status?: ReservationStatus;
  branchId?: string;
  customerId?: string;
}

const PAGE_SIZE = 25;
const RESERVATION_EXPAND = 'customer,vehicle';

export function useReservations(filters: ReservationFilters) {
  const { api } = useWebAuth();
  return useInfiniteQuery({
    queryKey: [...RESERVATIONS_QUERY_KEY, 'list', filters],
    queryFn: ({ pageParam }) =>
      api.requestPage<ReservationListItem>('/api/v1/reservations', {
        query: {
          ...filters,
          expand: RESERVATION_EXPAND,
          limit: PAGE_SIZE,
          cursor: pageParam ?? undefined,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    placeholderData: keepPreviousData,
  });
}

// Despues del check-in la factura se emite de forma asincrona y la reserva pasa a Closed: el
// detalle se refresca solo mientras esta en CheckedIn.
const CHECKED_IN_POLL_MS = 2000;

export function useReservation(id: string) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: reservationQueryKey(id),
    queryFn: () =>
      api.request<ReservationDetail>(`/api/v1/reservations/${id}`, {
        query: { expand: RESERVATION_EXPAND },
      }),
    refetchInterval: (query) =>
      query.state.data?.status === 'CheckedIn' ? CHECKED_IN_POLL_MS : false,
  });
}

export function useReservationInvoices(reservationId: string, enabled: boolean) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: ['invoices', 'by-reservation', reservationId],
    queryFn: () => api.request<InvoiceSummary[]>('/api/v1/invoices', { query: { reservationId } }),
    enabled,
    // La factura se emite de forma asincrona despues del check-in: se consulta de nuevo hasta
    // que aparece.
    refetchInterval: (query) => (query.state.data?.length ? false : CHECKED_IN_POLL_MS),
  });
}

// Catalogo chico y estable: sin paginar, cacheado 5 minutos.
export function useBranches() {
  const { status, api } = useWebAuth();
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.request<BranchSummary[]>('/api/v1/branches'),
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

// Zona horaria por sucursal. Mientras no cargan las sucursales (o si la sucursal no aparece),
// devuelve undefined: quien muestra fechas decide que hacer (p.ej. mostrar "...").
export function useBranchTimeZones(): (branchId: string | undefined) => string | undefined {
  const { data } = useBranches();
  const byId = new Map((data ?? []).map((branch) => [branch.id, branch.timeZone]));
  return (branchId) => (branchId ? byId.get(branchId) : undefined);
}

export function useCustomerSearch(q: string) {
  const { api } = useWebAuth();
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['customers', 'search', trimmed],
    queryFn: () =>
      api.requestPage<CustomerListItem>('/api/v1/customers', { query: { q: trimmed, limit: 10 } }),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export interface AvailabilitySearch {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

// GET /vehicles con startDate/endDate (#116): solo flota operable y sin ocupar en el rango.
export function useAvailableVehicles(search: AvailabilitySearch) {
  const { api } = useWebAuth();
  const { startDate, endDate, branchId } = search;
  return useQuery({
    queryKey: ['vehicles', 'available', search],
    queryFn: () =>
      api.request<VehicleSummary[]>('/api/v1/vehicles', {
        query: { startDate, endDate, branchId, expand: 'vehicleCategory' },
      }),
    enabled: Boolean(startDate && endDate && branchId),
  });
}
