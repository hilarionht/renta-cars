'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useCurrentUser, usePermissions, useWebAuth } from '@frontend/data-access-web';
import type { ReservationListItem } from '@frontend/domain-types';
import { Alert, PageHeader, Table } from '@frontend/ui-kit-web';

import styles from './home.module.css';
import { useReservationColumns } from './reservations/reservation-columns';

// #135: con expand=customer,vehicle y las fechas en la zona de la sucursal del vehiculo
// (cierra el gap de #134, que mostraba ids y la zona del navegador).
function useReservationsByStatus(status: 'Confirmed' | 'CheckedOut', enabled: boolean) {
  const { api } = useWebAuth();
  return useQuery({
    queryKey: ['reservations', 'home', status],
    queryFn: () =>
      api.requestPage<ReservationListItem>('/api/v1/reservations', {
        query: { status, limit: 5, expand: 'customer,vehicle' },
      }),
    enabled,
  });
}

// Inicio (docs/persistence/10-DECISIONES.md #134): quien opera retiros/devoluciones ve las
// reservas confirmadas y los vehiculos en alquiler; el resto, accesos rapidos.
export default function HomePage() {
  const { data: user } = useCurrentUser();
  const permissions = usePermissions();
  const operates = permissions.hasAny(['reservations:check-out', 'reservations:check-in']);
  const router = useRouter();
  const columns = useReservationColumns();
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
                columns={columns}
                rows={confirmed.data?.data}
                rowKey={(row) => row.id}
                isLoading={confirmed.isLoading}
                emptyMessage="No hay reservas confirmadas."
                onRowClick={(row) => router.push(`/reservations/${row.id}`)}
              />
            )}
          </section>
          <section>
            <h2 className={styles.sectionTitle}>Vehículos en alquiler</h2>
            {checkedOut.error ? (
              <Alert tone="danger">No se pudieron cargar las reservas.</Alert>
            ) : (
              <Table
                columns={columns}
                rows={checkedOut.data?.data}
                rowKey={(row) => row.id}
                isLoading={checkedOut.isLoading}
                emptyMessage="No hay vehículos retirados."
                onRowClick={(row) => router.push(`/reservations/${row.id}`)}
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
