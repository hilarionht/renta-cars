'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { useCurrentUser, usePermissions, useWebAuth } from '@frontend/data-access-web';
import type { ReservationSummary } from '@frontend/domain-types';
import { Alert, Badge, PageHeader, Table, type TableColumn } from '@frontend/ui-kit-web';

import { formatDateTime, formatMoney, shortId } from '../../lib/format';
import styles from './home.module.css';

const COLUMNS: readonly TableColumn<ReservationSummary>[] = [
  { key: 'id', header: 'Reserva', render: (row) => shortId(row.id) },
  { key: 'start', header: 'Retiro', render: (row) => formatDateTime(row.startDate) },
  { key: 'end', header: 'Devolución', render: (row) => formatDateTime(row.endDate) },
  {
    key: 'amount',
    header: 'Monto',
    render: (row) => formatMoney(row.baseAmountMinorUnits, row.currency),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => (
      <Badge tone={row.status === 'Confirmed' ? 'info' : 'warning'}>
        {row.status === 'Confirmed' ? 'Confirmada' : 'En alquiler'}
      </Badge>
    ),
  },
];

function useReservationsByStatus(status: 'Confirmed' | 'CheckedOut', enabled: boolean) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: ['home-reservations', status],
    queryFn: () =>
      api.requestPage<ReservationSummary>('/api/v1/reservations', { query: { status, limit: 5 } }),
    enabled,
  });
}

// Inicio (docs/persistence/10-DECISIONES.md #134): quien opera retiros/devoluciones ve las
// reservas confirmadas y los vehiculos en alquiler; el resto, accesos rapidos.
export default function HomePage() {
  const { data: user } = useCurrentUser();
  const permissions = usePermissions();
  const operates = permissions.hasAny(['reservations:check-out', 'reservations:check-in']);
  const confirmed = useReservationsByStatus('Confirmed', operates);
  const checkedOut = useReservationsByStatus('CheckedOut', operates);

  return (
    <>
      <PageHeader title={user ? `Hola, ${user.name}` : 'Inicio'} />
      {operates ? (
        <div className={styles.sections}>
          <section>
            <h2 className={styles.sectionTitle}>Próximos retiros</h2>
            {confirmed.error ? (
              <Alert tone="danger">No se pudieron cargar las reservas.</Alert>
            ) : (
              <Table
                columns={COLUMNS}
                rows={confirmed.data?.data}
                rowKey={(row) => row.id}
                isLoading={confirmed.isLoading}
                emptyMessage="No hay reservas confirmadas."
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Vehículos en alquiler</h2>
            {checkedOut.error ? (
              <Alert tone="danger">No se pudieron cargar las reservas.</Alert>
            ) : (
              <Table
                columns={COLUMNS}
                rows={checkedOut.data?.data}
                rowKey={(row) => row.id}
                isLoading={checkedOut.isLoading}
                emptyMessage="No hay vehículos retirados."
              />
            )}
          </section>
        </div>
      ) : (
        <ul className={styles.links}>
          <li>
            <Link href="/reservations">Reservas</Link>
          </li>
          <li>
            <Link href="/fleet">Flota</Link>
          </li>
          <li>
            <Link href="/customers">Clientes</Link>
          </li>
        </ul>
      )}
    </>
  );
}
