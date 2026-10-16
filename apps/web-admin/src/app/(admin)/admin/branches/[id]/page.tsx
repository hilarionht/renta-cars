'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import {
  useBranch,
  useBranchAction,
  usePermissions,
  useReservations,
} from '@frontend/data-access-web';
import type { BranchSummary } from '@frontend/domain-types';
import { Alert, Badge, Button, ConfirmDialog, PageHeader, Spinner } from '@frontend/ui-kit-web';

import { BRANCH_STATUS } from '../../../../../lib/admin-labels';
import { apiErrorMessage } from '../../../../../lib/api-error-message';
import { formatDateTime } from '../../../../../lib/format';
import { reservationStatusLabel } from '../../../../../lib/reservation-status';
import styles from '../../../admin-page.module.css';
import { BranchFields, branchFormErrors, branchFormToRequest, useBranchForm } from '../branch-form';

// Detalle y edicion de una sucursal (docs/persistence/10-DECISIONES.md #140). Cerrar muestra
// ANTES las reservas confirmadas o en curso que lo impiden (misma regla que el API, que vuelve a
// verificar y responde 409 BRANCH_HAS_ACTIVE_RESERVATIONS si algo cambio mientras tanto).
function CloseBranchDialog({ branch, onClose }: { branch: BranchSummary; onClose: () => void }) {
  const action = useBranchAction(branch.id);
  const confirmed = useReservations({ branchId: branch.id, status: 'Confirmed' });
  const checkedOut = useReservations({ branchId: branch.id, status: 'CheckedOut' });
  const [error, setError] = useState<string | null>(null);
  const blocking = [...(confirmed.data?.pages ?? []), ...(checkedOut.data?.pages ?? [])].flatMap(
    (page) => page.data,
  );
  const loading = confirmed.isLoading || checkedOut.isLoading;

  async function close() {
    setError(null);
    try {
      await action.mutateAsync({ action: 'close' });
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <ConfirmDialog
      open
      title={`Cerrar ${branch.name}`}
      message={
        <>
          {loading ? (
            <Spinner />
          ) : blocking.length > 0 ? (
            <Alert tone="danger">
              No se puede cerrar: estas reservas dependen de la sucursal. Cancelalas, cambiales el
              vehículo o esperá a que terminen.
              <ul>
                {blocking.map((reservation) => (
                  <li key={reservation.id}>
                    <Link href={`/reservations/${reservation.id}`}>
                      {reservation.customer?.name ?? 'Reserva'} · retiro{' '}
                      {formatDateTime(reservation.startDate, branch.timeZone)}
                    </Link>{' '}
                    ({reservationStatusLabel(reservation.status)})
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            'Una sucursal cerrada no admite retiros ni devoluciones, ni nuevos usuarios. Se puede reabrir.'
          )}
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </>
      }
      confirmLabel="Cerrar sucursal"
      cancelLabel="Volver"
      tone="danger"
      loading={action.isPending || loading}
      onConfirm={() => blocking.length === 0 && void close()}
      onCancel={onClose}
    />
  );
}

function BranchEditor({ branch, canEdit }: { branch: BranchSummary; canEdit: boolean }) {
  const action = useBranchAction(branch.id);
  const [form, setForm] = useBranchForm(branch);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const errors = branchFormErrors(form);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (errors.length > 0) {
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await action.mutateAsync({ action: 'update', body: branchFormToRequest(form) });
      setSaved(true);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
      <fieldset className={styles.fieldset} disabled={!canEdit}>
        <BranchFields
          form={form}
          onChange={(next) => {
            setSaved(false);
            setForm(next);
          }}
        />
      </fieldset>
      {canEdit && errors.length > 0 ? <Alert tone="warning">{errors.join(' ')}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Cambios guardados.</Alert> : null}
      {canEdit ? (
        <div className={styles.formActions}>
          <Button type="submit" disabled={errors.length > 0} loading={action.isPending}>
            Guardar cambios
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const branch = useBranch(id);
  const permissions = usePermissions();
  const reopen = useBranchAction(id);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = branch.data;
  if (branch.isLoading) {
    return <Spinner />;
  }
  if (branch.error || !data) {
    return (
      <>
        <Link href="/admin/branches" className={styles.back}>
          ← Sucursales
        </Link>
        <Alert tone="danger">No se encontró la sucursal.</Alert>
      </>
    );
  }
  const status = BRANCH_STATUS[data.status];

  async function doReopen() {
    setError(null);
    try {
      await reopen.mutateAsync({ action: 'reopen' });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Link href="/admin/branches" className={styles.back}>
        ← Sucursales
      </Link>
      <PageHeader
        title={data.name}
        description={data.timeZone}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className={styles.actions}>
        {data.status === 'Active' && permissions.has('branches:close') ? (
          <Button variant="danger" onClick={() => setClosing(true)}>
            Cerrar sucursal
          </Button>
        ) : null}
        {data.status === 'Closed' && permissions.has('branches:reopen') ? (
          <Button onClick={() => void doReopen()} loading={reopen.isPending}>
            Reabrir
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className={styles.section}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      <section className={styles.section}>
        {/* key: al guardar o recargar, el formulario arranca de los datos nuevos. */}
        <BranchEditor
          key={`${data.id}-${data.name}-${data.timeZone}-${data.status}`}
          branch={data}
          canEdit={permissions.has('branches:edit')}
        />
      </section>
      {closing ? <CloseBranchDialog branch={data} onClose={() => setClosing(false)} /> : null}
    </>
  );
}
