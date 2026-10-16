'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Can, useBranches } from '@frontend/data-access-web';
import type { BranchSummary } from '@frontend/domain-types';
import { Alert, Badge, PageHeader, Table, type TableColumn } from '@frontend/ui-kit-web';

import { BRANCH_STATUS } from '../../../../lib/admin-labels';
import styles from '../../admin-page.module.css';

// Sucursales (docs/persistence/10-DECISIONES.md #140).
const COLUMNS: readonly TableColumn<BranchSummary>[] = [
  { key: 'name', header: 'Sucursal', render: (row) => row.name },
  { key: 'city', header: 'Ciudad', render: (row) => row.address.city },
  { key: 'timeZone', header: 'Zona horaria', render: (row) => row.timeZone },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => {
      const status = BRANCH_STATUS[row.status];
      return <Badge tone={status.tone}>{status.label}</Badge>;
    },
  },
];

export default function BranchesPage() {
  const router = useRouter();
  const branches = useBranches();
  const rows = [...(branches.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return (
    <>
      <PageHeader
        title="Sucursales"
        actions={
          <Can permission="branches:create">
            <Link href="/admin/branches/new" className={styles.linkButton}>
              Nueva sucursal
            </Link>
          </Can>
        }
      />
      {branches.error ? (
        <Alert tone="danger">No se pudieron cargar las sucursales.</Alert>
      ) : (
        <Table
          columns={COLUMNS}
          rows={branches.data ? rows : undefined}
          rowKey={(row) => row.id}
          isLoading={branches.isLoading}
          emptyMessage="No hay sucursales."
          onRowClick={(row) => router.push(`/admin/branches/${row.id}`)}
        />
      )}
    </>
  );
}
