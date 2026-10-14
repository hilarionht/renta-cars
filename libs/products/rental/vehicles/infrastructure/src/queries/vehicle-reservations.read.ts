import type { Prisma } from '@prisma/client';

import type { VehicleActiveReservation, VehicleReservationRef } from '@rental/vehicles/application';

// docs/persistence/10-DECISIONES.md #137: estado de alquiler derivado en la lectura. El estado
// del vehiculo nunca pasa a Reserved/CheckedOut (son informativos en 08-STATE_MACHINES SS2),
// asi que se lee de las reservas. Lectura directa del schema `rental` del lado query, mismo
// precedente que el expand de reservations (#135): FK real, solo lectura, una sola consulta
// para todos los vehiculos (sin N+1).
//
// Solo Confirmed y CheckedOut, SIN filtro de fecha: una reserva atrasada (o un no-show sin
// marcar) sigue ocupando su slot Booking y bloquea igual el mantenimiento.
const ACTIVE_STATUSES = ['Confirmed', 'CheckedOut'] as const;

export async function loadActiveReservations(
  tx: Prisma.TransactionClient,
  vehicleIds: string[],
): Promise<Map<string, VehicleReservationRef[]>> {
  const byVehicle = new Map<string, VehicleReservationRef[]>();
  if (vehicleIds.length === 0) {
    return byVehicle;
  }
  const records = await tx.reservation.findMany({
    where: {
      vehicleId: { in: vehicleIds },
      status: { in: [...ACTIVE_STATUSES] },
      deletedAt: null,
    },
    select: { id: true, vehicleId: true, status: true, startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  });
  for (const record of records) {
    const list = byVehicle.get(record.vehicleId) ?? [];
    list.push({
      id: record.id,
      status: record.status,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
    });
    byVehicle.set(record.vehicleId, list);
  }
  return byVehicle;
}

/** Para el listado: la CheckedOut o, si no hay, la proxima Confirmed que todavia no termino. */
export function pickCurrentReservation(
  reservations: VehicleReservationRef[] | undefined,
  now: Date,
): VehicleReservationRef | undefined {
  if (!reservations || reservations.length === 0) {
    return undefined;
  }
  return (
    reservations.find((reservation) => reservation.status === 'CheckedOut') ??
    reservations.find(
      (reservation) => reservation.status === 'Confirmed' && new Date(reservation.endDate) > now,
    )
  );
}

/** Para el detalle: todas, marcando las que ya debieron terminar. */
export function withOverdueFlag(
  reservations: VehicleReservationRef[] | undefined,
  now: Date,
): VehicleActiveReservation[] {
  return (reservations ?? []).map((reservation) => ({
    ...reservation,
    overdue: new Date(reservation.endDate) < now,
  }));
}
