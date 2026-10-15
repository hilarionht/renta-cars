'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useCustomer,
  useCustomerAction,
  useCustomerActiveReservations,
  useFileSignedUrl,
  usePermissions,
  useReservations,
} from '@frontend/data-access-web';
import type { AdditionalDriver, IdentityDocument } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Spinner,
  Table,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import {
  CUSTOMER_TYPE_LABELS,
  DRIVER_STATUS,
  IDENTITY_DOCUMENT_TYPE_LABELS,
  canVerifyDocument,
  displayCustomerStatus,
  displayDocumentStatus,
  documentsOwnedBy,
  driverActions,
  hasValidLicense,
} from '../../../../lib/customer-status';
import { useReservationColumns } from '../../reservations/reservation-columns';
import styles from '../../admin-page.module.css';
import { CustomerDialogs, type CustomerDialog } from './customer-dialogs';

// Detalle de un cliente (docs/persistence/10-DECISIONES.md #139): datos editables, bloqueo,
// documentos con el historial de renovaciones (Replaced), conductores adicionales y reservas.
// El OCR no se expone: el proveedor todavia es un fake (pendiente #2 de CLAUDE.md).
const DATE_ONLY = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const customer = useCustomer(id);
  const activeReservations = useCustomerActiveReservations(id);
  const reservations = useReservations({ customerId: id });
  const reservationColumns = useReservationColumns();
  const permissions = usePermissions();
  const quickAction = useCustomerAction(id);
  const signedUrl = useFileSignedUrl();
  const [dialog, setDialog] = useState<CustomerDialog | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const data = customer.data;
  if (customer.isLoading) {
    return <Spinner />;
  }
  if (customer.error || !data) {
    return (
      <>
        <Link href="/customers" className={styles.back}>
          ← Clientes
        </Link>
        <Alert tone="danger">No se encontró el cliente.</Alert>
      </>
    );
  }

  const canEdit = permissions.has('customers:edit');
  const canBlock = permissions.has('customers:block');
  const canUnblock = permissions.has('customers:unblock');
  const canManageDocuments = permissions.has('customers:manage-documents');
  const canUpload = canManageDocuments && permissions.has('files:upload');
  const canVerify = permissions.has('customers:verify-documents');
  const isBlocked = data.blockStatus === 'Blocked';
  const display = displayCustomerStatus(data);
  const driverNames = new Map(data.additionalDrivers.map((driver) => [driver.id, driver.name]));
  const reservationRows = reservations.data?.pages.flatMap((page) => page.data);

  async function quick(input: Parameters<typeof quickAction.mutateAsync>[0]) {
    setRowError(null);
    try {
      await quickAction.mutateAsync(input);
    } catch (caught) {
      setRowError(apiErrorMessage(caught));
    }
  }

  // Mismo criterio que el detalle de vehiculo (#137): la pestana se abre en el click y la URL
  // firmada (vence en 5 minutos) se pide en el momento.
  async function openDocument(fileId: string) {
    setRowError(null);
    const tab = window.open('about:blank', '_blank');
    if (tab) {
      tab.opener = null;
    }
    try {
      const url = await signedUrl.mutateAsync(fileId);
      if (tab) {
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (caught) {
      tab?.close();
      setRowError(apiErrorMessage(caught));
    }
  }

  const documentColumns: readonly TableColumn<IdentityDocument>[] = [
    {
      key: 'owner',
      header: 'Titular',
      render: (row) =>
        row.ownerType === 'Customer' ? 'Cliente' : (driverNames.get(row.ownerId) ?? 'Conductor'),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => IDENTITY_DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType,
    },
    { key: 'expiry', header: 'Vence', render: (row) => DATE_ONLY.format(new Date(row.expiryDate)) },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const status = displayDocumentStatus(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => void openDocument(row.fileId)}>
            Ver
          </Button>
          {canVerify && canVerifyDocument(row) ? (
            <Button
              variant="secondary"
              onClick={() => void quick({ action: 'verify-document', documentId: row.id })}
            >
              Verificar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const driverColumns: readonly TableColumn<AdditionalDriver>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const status = DRIVER_STATUS[row.status] ?? { label: row.status, tone: 'neutral' };
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: 'license',
      header: 'Licencia',
      render: (row) =>
        hasValidLicense(row.id, data.identityDocuments) ? (
          <Badge tone="success">Vigente</Badge>
        ) : (
          <Badge tone="warning">Sin licencia vigente</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const actions = driverActions(row);
        return (
          <div className={styles.actions}>
            {canUpload && row.status !== 'Revoked' ? (
              <Button
                variant="ghost"
                onClick={() => setDialog({ kind: 'upload-document', driver: row })}
              >
                Cargar licencia
              </Button>
            ) : null}
            {canVerify && actions.includes('validate') ? (
              <Button
                variant="secondary"
                onClick={() => void quick({ action: 'validate-license', driverId: row.id })}
              >
                Validar licencia
              </Button>
            ) : null}
            {canVerify && actions.includes('revoke') ? (
              <Button
                variant="danger"
                onClick={() => setDialog({ kind: 'revoke-driver', driver: row })}
              >
                Revocar
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const customerDocuments = documentsOwnedBy(data.identityDocuments, { type: 'Customer' });
  const driverDocuments = data.identityDocuments.filter(
    (document) => document.ownerType === 'AdditionalDriver',
  );

  return (
    <>
      <Link href="/customers" className={styles.back}>
        ← Clientes
      </Link>
      <PageHeader
        title={data.name}
        description={CUSTOMER_TYPE_LABELS[data.customerType] ?? data.customerType}
        actions={<Badge tone={display.tone}>{display.label}</Badge>}
      />

      <div className={styles.actions}>
        {canEdit ? (
          <Button variant="secondary" onClick={() => setDialog({ kind: 'edit' })}>
            Editar
          </Button>
        ) : null}
        {isBlocked && canUnblock ? (
          <Button onClick={() => setDialog({ kind: 'unblock' })}>Desbloquear</Button>
        ) : null}
        {!isBlocked && canBlock ? (
          <Button variant="danger" onClick={() => setDialog({ kind: 'block' })}>
            Bloquear
          </Button>
        ) : null}
      </div>

      {isBlocked ? (
        <div className={styles.section}>
          <Alert tone="danger">
            Bloqueado{data.blockReason ? `: ${data.blockReason}` : ''}. No puede confirmar reservas
            ni retirar vehículos.
          </Alert>
        </div>
      ) : null}
      {data.status === 'Registered' && !isBlocked ? (
        <div className={styles.section}>
          <Alert tone="warning">
            Para alquilar hace falta un documento del cliente verificado y vigente.
          </Alert>
        </div>
      ) : null}
      {rowError ? (
        <div className={styles.section}>
          <Alert tone="danger">{rowError}</Alert>
        </div>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Documento</dt>
            <dd>{data.taxIdOrDocumentId}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{data.contactEmail}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{data.contactPhone}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <h2 className={styles.sectionTitle}>Documentos</h2>
          {canUpload ? (
            <Button variant="secondary" onClick={() => setDialog({ kind: 'upload-document' })}>
              Cargar documento
            </Button>
          ) : null}
        </div>
        <Table
          columns={documentColumns}
          rows={[...customerDocuments, ...driverDocuments]}
          rowKey={(row) => row.id}
          emptyMessage="Sin documentos."
        />
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <h2 className={styles.sectionTitle}>Conductores adicionales</h2>
          {canManageDocuments ? (
            <Button variant="secondary" onClick={() => setDialog({ kind: 'register-driver' })}>
              Agregar conductor
            </Button>
          ) : null}
        </div>
        <Table
          columns={driverColumns}
          rows={data.additionalDrivers}
          rowKey={(row) => row.id}
          emptyMessage="Sin conductores adicionales."
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reservas</h2>
        {reservations.error ? (
          <Alert tone="danger">No se pudieron cargar las reservas.</Alert>
        ) : (
          <>
            <Table
              columns={reservationColumns}
              rows={reservationRows}
              rowKey={(row) => row.id}
              isLoading={reservations.isLoading}
              emptyMessage="Sin reservas."
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
      </section>

      {dialog ? (
        <CustomerDialogs
          dialog={dialog}
          customer={data}
          activeReservations={activeReservations.data}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
