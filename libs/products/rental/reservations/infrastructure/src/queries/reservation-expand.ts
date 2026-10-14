import type { Prisma } from '@prisma/client';

import { UnsupportedExpandError } from '@platform/shared-kernel';
import {
  RESERVATION_EXPAND_VALUES,
  type ReservationExpandValue,
  type ReservationExpansions,
} from '@rental/reservations/application';

// docs/persistence/10-DECISIONES.md #135: `?expand=` de reservations (segunda
// implementacion real despues de #123). Lee customer/vehicle directo de Prisma en vez de ir
// por los puertos de customers/vehicles: son FK reales del mismo schema `rental`, es solo
// lectura (lado query de CQRS) y los puertos leen de a un registro (N+1 en un listado).
export function parseReservationExpand(values: string[] | undefined): ReservationExpandValue[] {
  const parsed: ReservationExpandValue[] = [];
  for (const value of values ?? []) {
    if (!RESERVATION_EXPAND_VALUES.includes(value as ReservationExpandValue)) {
      throw new UnsupportedExpandError(value, [...RESERVATION_EXPAND_VALUES]);
    }
    if (!parsed.includes(value as ReservationExpandValue)) {
      parsed.push(value as ReservationExpandValue);
    }
  }
  return parsed;
}

// Devuelve, por id de reserva, los objetos expandidos. Como mucho una lectura por valor de
// expand, nunca una por reserva.
export async function loadReservationExpansions(
  tx: Prisma.TransactionClient,
  reservations: { id: string; customerId: string; vehicleId: string }[],
  expand: ReservationExpandValue[],
): Promise<Map<string, ReservationExpansions>> {
  const result = new Map<string, ReservationExpansions>(
    reservations.map((reservation) => [reservation.id, {}]),
  );
  if (reservations.length === 0 || expand.length === 0) {
    return result;
  }

  if (expand.includes('customer')) {
    const ids = [...new Set(reservations.map((reservation) => reservation.customerId))];
    const customers = await tx.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const byId = new Map(customers.map((customer) => [customer.id, customer]));
    for (const reservation of reservations) {
      const customer = byId.get(reservation.customerId);
      if (customer) {
        result.get(reservation.id)!.customer = customer;
      }
    }
  }

  if (expand.includes('vehicle')) {
    const ids = [...new Set(reservations.map((reservation) => reservation.vehicleId))];
    const vehicles = await tx.vehicle.findMany({
      where: { id: { in: ids } },
      select: { id: true, licensePlate: true, branchId: true },
    });
    const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    for (const reservation of reservations) {
      const vehicle = byId.get(reservation.vehicleId);
      if (vehicle) {
        result.get(reservation.id)!.vehicle = vehicle;
      }
    }
  }

  return result;
}
