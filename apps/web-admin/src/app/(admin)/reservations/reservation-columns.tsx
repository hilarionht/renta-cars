'use client';

import { useBranchTimeZones } from '@frontend/data-access-web';
import type { ReservationListItem } from '@frontend/domain-types';
import { Badge, type TableColumn } from '@frontend/ui-kit-web';

import { formatDateTime, formatMoney, shortId } from '../../../lib/format';
import { reservationStatusLabel, reservationStatusTone } from '../../../lib/reservation-status';

// Columnas de reservas compartidas por Inicio y el listado (docs/persistence/10-DECISIONES.md
// #135). Las fechas van en la zona de la sucursal del vehiculo (expand=vehicle trae branchId).
export function useReservationColumns(): readonly TableColumn<ReservationListItem>[] {
  const timeZoneOf = useBranchTimeZones();
  return [
    { key: 'id', header: 'Reserva', render: (row) => shortId(row.id) },
    { key: 'customer', header: 'Cliente', render: (row) => row.customer?.name ?? '—' },
    { key: 'vehicle', header: 'Vehículo', render: (row) => row.vehicle?.licensePlate ?? '—' },
    {
      key: 'start',
      header: 'Retiro',
      render: (row) => formatDateTime(row.startDate, timeZoneOf(row.vehicle?.branchId)),
    },
    {
      key: 'end',
      header: 'Devolución',
      render: (row) => formatDateTime(row.endDate, timeZoneOf(row.vehicle?.branchId)),
    },
    {
      key: 'amount',
      header: 'Monto',
      render: (row) => formatMoney(row.baseAmountMinorUnits, row.currency),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge tone={reservationStatusTone(row.status)}>{reservationStatusLabel(row.status)}</Badge>
      ),
    },
  ];
}
