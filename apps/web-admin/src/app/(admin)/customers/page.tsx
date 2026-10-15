'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useCustomers } from '@frontend/data-access-web';
import type { CustomerListItem } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { CUSTOMER_TYPE_LABELS, displayCustomerStatus } from '../../../lib/customer-status';
import { useDebouncedValue } from '../../../lib/use-debounced-value';
import styles from '../admin-page.module.css';

// Listado de clientes (docs/persistence/10-DECISIONES.md #139): busqueda en el servidor por
// nombre o documento (q, #135) y paginado por cursor con "Cargar mas".
const COLUMNS: readonly TableColumn<CustomerListItem>[] = [
  { key: 'name', header: 'Nombre', render: (row) => row.name },
  { key: 'document', header: 'Documento', render: (row) => row.taxIdOrDocumentId },
  {
    key: 'type',
    header: 'Tipo',
    render: (row) => CUSTOMER_TYPE_LABELS[row.customerType] ?? row.customerType,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => {
      const display = displayCustomerStatus(row);
      return <Badge tone={display.tone}>{display.label}</Badge>;
    },
  },
];

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const customers = useCustomers(q);
  const rows = customers.data?.pages.flatMap((page) => page.data);

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <Can permission="customers:create">
            <Link href="/customers/new" className={styles.linkButton}>
              Nuevo cliente
            </Link>
          </Can>
        }
      />
      <div className={styles.filters}>
        <TextField
          label="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          hint="Nombre o documento"
          autoComplete="off"
        />
      </div>
      {customers.error ? (
        <Alert tone="danger">No se pudieron cargar los clientes.</Alert>
      ) : (
        <>
          <Table
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={customers.isLoading}
            emptyMessage={
              q.trim() ? 'Ningún cliente coincide con la búsqueda.' : 'No hay clientes.'
            }
            onRowClick={(row) => router.push(`/customers/${row.id}`)}
          />
          {customers.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button
                variant="secondary"
                loading={customers.isFetchingNextPage}
                onClick={() => void customers.fetchNextPage()}
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
