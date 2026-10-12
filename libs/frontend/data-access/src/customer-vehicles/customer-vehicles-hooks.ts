// Mismo patron que customer-reservations/customer-reservations-hooks.ts (React Query via
// customerApiRequest). Busqueda de vehiculos disponibles (docs/persistence/10-DECISIONES.md
// #116/#123) - expand=vehicleCategory siempre pedido, es el unico uso de este hook (mostrar
// la categoria en la lista de seleccion).
import { useQuery } from '@tanstack/react-query';

import type { VehicleSummary } from '@frontend/domain-types';

import { customerApiRequest } from '../customer-auth/customer-api-client';

export function useSearchAvailableVehicles(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['vehicles', 'search', startDate, endDate] as const,
    queryFn: () =>
      customerApiRequest<VehicleSummary[]>(
        `/api/v1/vehicles?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&expand=vehicleCategory`,
      ),
    enabled: startDate.length > 0 && endDate.length > 0,
  });
}
