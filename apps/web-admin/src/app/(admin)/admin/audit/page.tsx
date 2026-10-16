'use client';

import { useState } from 'react';

import { useActorName, useAuditLog, usePermissions } from '@frontend/data-access-web';
import type { AuditLogEntry } from '@frontend/domain-types';
import {
  Alert,
  Button,
  PageHeader,
  Select,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { AUDIT_SUBJECT_LABELS, auditActionLabel } from '../../../../lib/admin-labels';
import { formatDateTime, shortId } from '../../../../lib/format';
import { useDebouncedValue } from '../../../../lib/use-debounced-value';
import styles from '../../admin-page.module.css';

// Auditoria (docs/persistence/10-DECISIONES.md #140): registro de cada evento de dominio, en orden
// de registro, paginado. Fechas en la zona del navegador (la auditoria no es de una sucursal).
function ActorCell({ actorRef }: { actorRef: string }) {
  const name = useActorName(actorRef);
  if (actorRef === 'system') {
    return <>Sistema</>;
  }
  return <>{name.data ?? shortId(actorRef)}</>;
}

// Fecha local del navegador -> limite del dia en ISO.
function dayBound(date: string, end: boolean): string | undefined {
  if (!date) {
    return undefined;
  }
  const local = new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
}

const COLUMNS: readonly TableColumn<AuditLogEntry>[] = [
  { key: 'when', header: 'Fecha', render: (row) => formatDateTime(row.occurredAt) },
  { key: 'actor', header: 'Quién', render: (row) => <ActorCell actorRef={row.actorRef} /> },
  { key: 'action', header: 'Evento', render: (row) => auditActionLabel(row.action) },
  {
    key: 'subject',
    header: 'Sobre',
    render: (row) =>
      `${AUDIT_SUBJECT_LABELS[row.subjectType] ?? row.subjectType} ${shortId(row.subjectId)}`,
  },
  {
    key: 'payload',
    header: '',
    render: (row) => (
      <details>
        <summary>Detalle</summary>
        <pre className={styles.muted}>{JSON.stringify(row.payload, null, 2)}</pre>
      </details>
    ),
  },
];

export default function AuditPage() {
  const permissions = usePermissions();
  const canRead = permissions.has('audit:read');
  const [subjectType, setSubjectType] = useState('');
  const [subjectIdInput, setSubjectIdInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const subjectId = useDebouncedValue(subjectIdInput.trim());
  const audit = useAuditLog(
    {
      subjectType: subjectType || undefined,
      subjectId: subjectId || undefined,
      from: dayBound(from, false),
      to: dayBound(to, true),
    },
    canRead,
  );
  const rows = audit.data?.pages.flatMap((page) => page.data);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Auditoría" />
        <Alert tone="warning">No tenés permiso para ver la auditoría.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Auditoría" />
      <div className={styles.filters}>
        <Select
          label="Sobre"
          value={subjectType}
          onChange={(event) => setSubjectType(event.target.value)}
          placeholder="Todo"
          options={Object.entries(AUDIT_SUBJECT_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <TextField
          label="Id"
          value={subjectIdInput}
          onChange={(event) => setSubjectIdInput(event.target.value)}
          autoComplete="off"
        />
        <TextField
          label="Desde"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          label="Hasta"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      {audit.error ? (
        <Alert tone="danger">No se pudo cargar la auditoría.</Alert>
      ) : (
        <>
          <Table
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={audit.isLoading}
            emptyMessage="No hay eventos con esos filtros."
          />
          {audit.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button
                variant="secondary"
                loading={audit.isFetchingNextPage}
                onClick={() => void audit.fetchNextPage()}
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
