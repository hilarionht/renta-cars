'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useBranchTimeZones,
  useBranches,
  useFileSignedUrl,
  usePermissions,
  useVehicle,
  useVehicleAction,
  useVehicleCategories,
} from '@frontend/data-access-web';
import type {
  MaintenanceRecord,
  VehicleActiveReservation,
  VehicleDocument,
} from '@frontend/domain-types';
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
import { formatDateTime } from '../../../../lib/format';
import { reservationStatusLabel } from '../../../../lib/reservation-status';
import {
  DOCUMENT_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
  availableVehicleActions,
  displayVehicleStatus,
  type VehicleUiAction,
} from '../../../../lib/vehicle-status';
import { canVerifyDocument, displayDocumentStatus } from '../../../../lib/document-status';
import styles from '../../admin-page.module.css';
import { VehicleDialogs, type VehicleDialog } from './vehicle-dialogs';

// Detalle de un vehiculo (docs/persistence/10-DECISIONES.md #137): datos, reservas activas
// (derivadas, incluidas las atrasadas), documentos con subida real del archivo, mantenimientos
// y acciones segun estado y permiso.
const ACTION_LABELS: Record<VehicleUiAction, string> = {
  enable: 'Habilitar',
  'schedule-maintenance': 'Programar mantenimiento',
  'report-damage': 'Reportar daño',
  'mark-out-of-service': 'Fuera de servicio',
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicle = useVehicle(id);
  const permissions = usePermissions();
  const branches = useBranches();
  const categories = useVehicleCategories();
  const timeZoneOf = useBranchTimeZones();
  const quickAction = useVehicleAction(id);
  const signedUrl = useFileSignedUrl();
  const [dialog, setDialog] = useState<VehicleDialog | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const data = vehicle.data;
  if (vehicle.isLoading) {
    return <Spinner />;
  }
  if (vehicle.error || !data) {
    return (
      <>
        <Link href="/fleet" className={styles.back}>
          ← Flota
        </Link>
        <Alert tone="danger">No se encontró el vehículo.</Alert>
      </>
    );
  }

  const canManage = permissions.has('vehicles:manage');
  const canUpload = canManage && permissions.has('files:upload');
  const timeZone = timeZoneOf(data.branchId);
  const display = displayVehicleStatus({
    status: data.status,
    activeReservation: data.activeReservations?.find((r) => r.status === 'CheckedOut'),
  });
  const actions = availableVehicleActions(data.status, canManage);
  const branchName = branches.data?.find((branch) => branch.id === data.branchId)?.name;
  const categoryName = categories.data?.find((c) => c.id === data.vehicleCategoryId)?.name;

  async function quick(input: Parameters<typeof quickAction.mutateAsync>[0]) {
    setRowError(null);
    try {
      await quickAction.mutateAsync(input);
    } catch (caught) {
      setRowError(apiErrorMessage(caught));
    }
  }

  // La pestana se abre en el click (gesto del usuario): abrirla despues del await la bloquearia
  // el bloqueador de pop-ups. La URL firmada vence en 5 minutos, por eso se pide en el momento.
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

  const reservationColumns: readonly TableColumn<VehicleActiveReservation>[] = [
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <>
          {reservationStatusLabel(row.status)}{' '}
          {row.overdue ? <Badge tone="danger">Atrasada</Badge> : null}
        </>
      ),
    },
    { key: 'start', header: 'Retiro', render: (row) => formatDateTime(row.startDate, timeZone) },
    { key: 'end', header: 'Devolución', render: (row) => formatDateTime(row.endDate, timeZone) },
    {
      key: 'link',
      header: '',
      render: (row) => <Link href={`/reservations/${row.id}`}>Ver reserva</Link>,
    },
  ];

  const documentColumns: readonly TableColumn<VehicleDocument>[] = [
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType,
    },
    { key: 'expiry', header: 'Vence', render: (row) => formatDateTime(row.expiryDate, timeZone) },
    {
      key: 'status',
      header: 'Estado',
      // #139: Replaced es historial de renovaciones.
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
          {canManage && canVerifyDocument(row) ? (
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

  const maintenanceColumns: readonly TableColumn<MaintenanceRecord>[] = [
    { key: 'type', header: 'Tipo', render: (row) => MAINTENANCE_TYPE_LABELS[row.type] ?? row.type },
    {
      key: 'window',
      header: 'Ventana',
      render: (row) =>
        `${formatDateTime(row.scheduledStart, timeZone)} → ${formatDateTime(row.scheduledEnd, timeZone)}`,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) =>
        `${MAINTENANCE_STATUS_LABELS[row.status] ?? row.status}${
          row.status === 'Completed' ? (row.fitForService ? ' (apto)' : ' (no apto)') : ''
        }`,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        !canManage ? null : row.status === 'Scheduled' ? (
          <Button
            variant="secondary"
            onClick={() => void quick({ action: 'start-maintenance', maintenanceId: row.id })}
          >
            Iniciar
          </Button>
        ) : row.status === 'InProgress' ? (
          <Button
            onClick={() => setDialog({ kind: 'complete-maintenance', maintenanceId: row.id })}
          >
            Completar
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Link href="/fleet" className={styles.back}>
        ← Flota
      </Link>
      <PageHeader
        title={`Vehículo ${data.licensePlate}`}
        description={categoryName}
        actions={<Badge tone={display.tone}>{display.label}</Badge>}
      />

      {actions.length > 0 ? (
        <div className={styles.actions}>
          {actions.map((action) => (
            <Button
              key={action}
              variant={
                action === 'mark-out-of-service'
                  ? 'danger'
                  : action === actions[0]
                    ? 'primary'
                    : 'secondary'
              }
              onClick={() => setDialog({ kind: 'action', action })}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
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
            <dt>Patente</dt>
            <dd>{data.licensePlate}</dd>
          </div>
          <div>
            <dt>VIN</dt>
            <dd>{data.vin}</dd>
          </div>
          <div>
            <dt>Categoría</dt>
            <dd>{categoryName ?? '—'}</dd>
          </div>
          <div>
            <dt>Sucursal</dt>
            <dd>{branchName ?? '—'}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd>{timeZone ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reservas activas</h2>
        <Table
          columns={reservationColumns}
          rows={data.activeReservations ?? []}
          rowKey={(row) => row.id}
          emptyMessage="Sin reservas confirmadas ni en curso."
        />
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
          rows={data.vehicleDocuments}
          rowKey={(row) => row.id}
          emptyMessage="Sin documentos. Para habilitar el vehículo hace falta uno verificado y vigente."
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mantenimientos</h2>
        <Table
          columns={maintenanceColumns}
          rows={data.maintenanceRecords}
          rowKey={(row) => row.id}
          emptyMessage="Sin mantenimientos."
        />
      </section>

      {dialog && timeZone ? (
        <VehicleDialogs
          dialog={dialog}
          vehicle={data}
          timeZone={timeZone}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
