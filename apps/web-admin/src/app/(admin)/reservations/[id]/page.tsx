'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useBranchTimeZones,
  useCurrentUser,
  usePermissions,
  useReservation,
  useReservationInvoices,
} from '@frontend/data-access-web';
import type {
  InvoiceCharge,
  ReservationDamageReport,
  ReservationInspection,
  ReservationPriceAdjustment,
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

import { formatDateTime, formatMoney, shortId } from '../../../../lib/format';
import {
  availableActions,
  reservationStatusLabel,
  reservationStatusTone,
  type ReservationUiAction,
} from '../../../../lib/reservation-status';
import styles from '../../admin-page.module.css';
import { ReservationActionDialog } from './action-dialogs';

// Detalle de una reserva para el personal (docs/persistence/10-DECISIONES.md #135): datos,
// inspecciones, danos, ajustes y factura, con las acciones habilitadas por estado y permiso.
const ACTION_LABELS: Record<ReservationUiAction, string> = {
  confirm: 'Confirmar',
  'check-out': 'Check-out',
  'check-in': 'Check-in',
  reschedule: 'Reprogramar',
  extend: 'Extender',
  'swap-vehicle': 'Cambiar vehículo',
  'mark-no-show': 'No se presentó',
  cancel: 'Cancelar',
};

const ADJUSTMENT_LABELS: Record<string, string> = {
  Extension: 'Extensión',
  LateReturnPenalty: 'Devolución tardía',
  DamagePenalty: 'Daño',
  FuelDifference: 'Diferencia de combustible',
  CancellationPenalty: 'Cancelación',
};

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reservation = useReservation(id);
  const { data: user } = useCurrentUser();
  const permissions = usePermissions();
  const timeZoneOf = useBranchTimeZones();
  const [action, setAction] = useState<ReservationUiAction | null>(null);

  const data = reservation.data;
  const timeZone = timeZoneOf(data?.vehicle?.branchId);
  const invoicesEnabled = data?.status === 'CheckedIn' || data?.status === 'Closed';
  const invoices = useReservationInvoices(id, invoicesEnabled);

  if (reservation.isLoading) {
    return <Spinner />;
  }
  if (reservation.error || !data) {
    return (
      <>
        <Link href="/reservations" className={styles.back}>
          ← Reservas
        </Link>
        <Alert tone="danger">No se encontró la reserva.</Alert>
      </>
    );
  }

  const actions = availableActions(data, permissions.hasAny);
  const inspectionColumns: readonly TableColumn<ReservationInspection>[] = [
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => (row.type === 'CheckOut' ? 'Retiro' : 'Devolución'),
    },
    { key: 'at', header: 'Fecha', render: (row) => formatDateTime(row.inspectedAt, timeZone) },
    { key: 'odometer', header: 'Odómetro', render: (row) => `${row.odometer} km` },
    { key: 'fuel', header: 'Combustible', render: (row) => `${row.fuelLevel}%` },
    {
      key: 'by',
      header: 'Inspeccionó',
      render: (row) => (row.inspectedBy === user?.id ? 'Vos' : shortId(row.inspectedBy)),
    },
  ];
  const damageColumns: readonly TableColumn<ReservationDamageReport>[] = [
    { key: 'description', header: 'Descripción', render: (row) => row.description },
    {
      key: 'severity',
      header: 'Gravedad',
      render: (row) => (
        <Badge tone={row.severity === 'Severe' ? 'danger' : 'warning'}>
          {row.severity === 'Severe' ? 'Grave' : 'Leve'}
        </Badge>
      ),
    },
    {
      key: 'imputable',
      header: 'Imputable',
      render: (row) => (row.imputableToCustomer ? 'Sí' : 'No'),
    },
  ];
  const adjustmentColumns: readonly TableColumn<ReservationPriceAdjustment>[] = [
    { key: 'kind', header: 'Concepto', render: (row) => ADJUSTMENT_LABELS[row.kind] ?? row.kind },
    { key: 'reason', header: 'Motivo', render: (row) => row.reason ?? '—' },
    {
      key: 'amount',
      header: 'Monto',
      render: (row) => formatMoney(row.amountMinorUnits, row.currency),
    },
  ];
  const chargeColumns: readonly TableColumn<InvoiceCharge>[] = [
    { key: 'description', header: 'Concepto', render: (row) => row.description },
    {
      key: 'amount',
      header: 'Monto',
      render: (row) => formatMoney(row.amountMinorUnits, row.currency),
    },
  ];
  const invoice = invoices.data?.find((candidate) => candidate.status === 'Issued');

  return (
    <>
      <Link href="/reservations" className={styles.back}>
        ← Reservas
      </Link>
      <PageHeader
        title={`Reserva ${shortId(data.id)}`}
        description={data.customer?.name}
        actions={
          <Badge tone={reservationStatusTone(data.status)}>
            {reservationStatusLabel(data.status)}
          </Badge>
        }
      />

      {actions.length > 0 && user ? (
        <div className={styles.actions}>
          {actions.map((candidate) => (
            <Button
              key={candidate}
              variant={
                candidate === 'cancel' || candidate === 'mark-no-show'
                  ? 'danger'
                  : candidate === actions[0]
                    ? 'primary'
                    : 'secondary'
              }
              onClick={() => setAction(candidate)}
            >
              {ACTION_LABELS[candidate]}
            </Button>
          ))}
        </div>
      ) : null}

      {data.status === 'CheckedIn' ? (
        <div className={styles.section}>
          <Alert tone="info">Emitiendo la factura… la reserva se cierra en unos segundos.</Alert>
        </div>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Cliente</dt>
            <dd>{data.customer?.name ?? shortId(data.customerId)}</dd>
          </div>
          <div>
            <dt>Vehículo</dt>
            <dd>{data.vehicle?.licensePlate ?? shortId(data.vehicleId)}</dd>
          </div>
          <div>
            <dt>Retiro</dt>
            <dd>{formatDateTime(data.startDate, timeZone)}</dd>
          </div>
          <div>
            <dt>Devolución</dt>
            <dd>{formatDateTime(data.endDate, timeZone)}</dd>
          </div>
          <div>
            <dt>Monto base</dt>
            <dd>{formatMoney(data.baseAmountMinorUnits, data.currency)}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd>{timeZone ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {data.inspections.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Inspecciones</h2>
          <Table columns={inspectionColumns} rows={data.inspections} rowKey={(row) => row.id} />
        </section>
      ) : null}

      {data.damageReports.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Daños</h2>
          <Table columns={damageColumns} rows={data.damageReports} rowKey={(row) => row.id} />
        </section>
      ) : null}

      {data.priceAdjustments.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ajustes de precio</h2>
          <Table
            columns={adjustmentColumns}
            rows={data.priceAdjustments}
            rowKey={(row) => row.id}
          />
        </section>
      ) : null}

      {invoice ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Factura {invoice.invoiceNumber} ·{' '}
            {formatMoney(invoice.totalMinorUnits, invoice.currency)}
          </h2>
          <Table columns={chargeColumns} rows={invoice.charges} rowKey={(row) => row.id} />
          <p className={styles.muted}>
            Impuestos: {formatMoney(invoice.taxAmountMinorUnits, invoice.currency)}
          </p>
        </section>
      ) : null}

      {action && user && timeZone ? (
        <ReservationActionDialog
          action={action}
          reservation={data}
          timeZone={timeZone}
          currentUserId={user.id}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
