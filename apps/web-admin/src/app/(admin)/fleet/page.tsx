'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useBranchTimeZones, useBranches, useVehicles } from '@frontend/data-access-web';
import type { VehicleStatus, VehicleSummary } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  PageHeader,
  Select,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { formatDateTime } from '../../../lib/format';
import {
  VEHICLE_FILTER_STATUSES,
  VEHICLE_STATUS_LABELS,
  displayVehicleStatus,
} from '../../../lib/vehicle-status';
import styles from '../admin-page.module.css';

// Listado de flota (docs/persistence/10-DECISIONES.md #137). El estado mostrado se deriva: un
// vehiculo Available con una reserva CheckedOut figura "En alquiler". Sucursal filtra en el API;
// estado y patente, en el cliente (el listado no se pagina).
export default function FleetPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState<VehicleStatus | ''>('');
  const [plate, setPlate] = useState('');
  const branches = useBranches();
  const timeZoneOf = useBranchTimeZones();
  const vehicles = useVehicles({ branchId: branchId || undefined });
  const branchName = new Map((branches.data ?? []).map((branch) => [branch.id, branch.name]));

  const plateQuery = plate.trim().toUpperCase();
  const rows = (vehicles.data ?? [])
    .filter((vehicle) => !status || displayVehicleStatus(vehicle).key === status)
    .filter((vehicle) => !plateQuery || vehicle.licensePlate.includes(plateQuery))
    .sort((a, b) => a.licensePlate.localeCompare(b.licensePlate));

  const columns: readonly TableColumn<VehicleSummary>[] = [
    { key: 'plate', header: 'Patente', render: (row) => row.licensePlate },
    { key: 'category', header: 'Categoría', render: (row) => row.vehicleCategory?.name ?? '—' },
    { key: 'branch', header: 'Sucursal', render: (row) => branchName.get(row.branchId) ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const display = displayVehicleStatus(row);
        return <Badge tone={display.tone}>{display.label}</Badge>;
      },
    },
    {
      key: 'reservation',
      header: 'Reserva',
      render: (row) => {
        const reservation = row.activeReservation;
        if (!reservation) {
          return '—';
        }
        const timeZone = timeZoneOf(row.branchId);
        return reservation.status === 'CheckedOut'
          ? `Devuelve ${formatDateTime(reservation.endDate, timeZone)}`
          : `Retira ${formatDateTime(reservation.startDate, timeZone)}`;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Flota"
        actions={
          <Can permission="vehicles:manage">
            <Link href="/fleet/new" className={styles.linkButton}>
              Nuevo vehículo
            </Link>
          </Can>
        }
      />
      <div className={styles.filters}>
        <Select
          label="Sucursal"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          placeholder="Todas"
          options={(branches.data ?? []).map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
        />
        <Select
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as VehicleStatus | '')}
          placeholder="Todos"
          options={VEHICLE_FILTER_STATUSES.map((value) => ({
            value,
            label: VEHICLE_STATUS_LABELS[value],
          }))}
        />
        <TextField
          label="Patente"
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
          autoComplete="off"
        />
      </div>
      {vehicles.error ? (
        <Alert tone="danger">No se pudo cargar la flota.</Alert>
      ) : (
        <Table
          columns={columns}
          rows={vehicles.data ? rows : undefined}
          rowKey={(row) => row.id}
          isLoading={vehicles.isLoading}
          emptyMessage="No hay vehículos con esos filtros."
          onRowClick={(row) => router.push(`/fleet/${row.id}`)}
        />
      )}
    </>
  );
}
