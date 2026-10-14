'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useBranches, useReservations } from '@frontend/data-access-web';
import type { ReservationStatus } from '@frontend/domain-types';
import { Alert, Button, PageHeader, Select, Table } from '@frontend/ui-kit-web';

import { RESERVATION_STATUSES, reservationStatusLabel } from '../../../lib/reservation-status';
import { useReservationColumns } from './reservation-columns';
import styles from './reservations.module.css';

// Listado de reservas (docs/persistence/10-DECISIONES.md #135): filtros por estado y sucursal,
// paginado por cursor con "Cargar mas". Un usuario de sucursal ve solo la suya aunque elija
// otra: el API usa la del token.
export default function ReservationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReservationStatus | ''>('');
  const [branchId, setBranchId] = useState('');
  const branches = useBranches();
  const columns = useReservationColumns();
  const reservations = useReservations({
    status: status || undefined,
    branchId: branchId || undefined,
  });
  const rows = reservations.data?.pages.flatMap((page) => page.data);

  return (
    <>
      <PageHeader
        title="Reservas"
        actions={
          <Can permission="reservations:create">
            <Link href="/reservations/new" className={styles.linkButton}>
              Nueva reserva
            </Link>
          </Can>
        }
      />
      <div className={styles.filters}>
        <Select
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as ReservationStatus | '')}
          placeholder="Todos"
          options={RESERVATION_STATUSES.map((value) => ({
            value,
            label: reservationStatusLabel(value),
          }))}
        />
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
      </div>
      {reservations.error ? (
        <Alert tone="danger">No se pudieron cargar las reservas.</Alert>
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={reservations.isLoading}
            emptyMessage="No hay reservas con esos filtros."
            onRowClick={(row) => router.push(`/reservations/${row.id}`)}
          />
          {reservations.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button
                variant="secondary"
                loading={reservations.isFetchingNextPage}
                onClick={() => void reservations.fetchNextPage()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
