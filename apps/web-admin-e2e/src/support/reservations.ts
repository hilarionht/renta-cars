import {
  createConfirmedReservation,
  createEligibleCustomer,
  createEnabledVehicle,
  type ApiClient,
} from '../../../../tooling/testing/seed/api-seed';
import { seeded } from './fixtures';

// docs/persistence/10-DECISIONES.md #154 y #155: reservas sembradas por la API, con vehiculo y
// cliente nuevos por intento (un reintento no choca con el vehiculo ya ocupado).

export const DAY = 86_400_000;

export interface ReservationSnapshot {
  status: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
}

export function readReservation(api: ApiClient, id: string): Promise<ReservationSnapshot> {
  return api.call<ReservationSnapshot>('GET', `/reservations/${id}`);
}

export function createBranchVehicle(api: ApiClient): Promise<{ id: string; licensePlate: string }> {
  return createEnabledVehicle(api, {
    branchId: seeded('WEB_E2E_BRANCH_ID'),
    categoryId: seeded('WEB_E2E_CATEGORY_ID'),
  });
}

// Reserva confirmada de `days` dias desde `startDate` (puede estar en el pasado: la
// anticipacion minima por defecto es 0 y el API no rechaza un retiro vencido).
export async function seedConfirmed(
  api: ApiClient,
  startDate: Date,
  days: number,
): Promise<string> {
  const vehicle = await createBranchVehicle(api);
  const customer = await createEligibleCustomer(api);
  return createConfirmedReservation(api, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    startDate,
    endDate: new Date(startDate.getTime() + days * DAY),
  });
}
