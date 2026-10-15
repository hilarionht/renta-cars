'use client';

import Link from 'next/link';
import { useState } from 'react';

import { zonedLocalToUtcIso } from '@frontend/data-access-core';
import {
  useUploadFile,
  useVehicleAction,
  type VehicleActionInput,
} from '@frontend/data-access-web';
import type {
  DamageSeverityLevel,
  MaintenanceType,
  VehicleActiveReservation,
  VehicleDetail,
  VehicleDocumentType,
} from '@frontend/domain-types';
import { Alert, ConfirmDialog, FileInput, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import { formatDateTime } from '../../../../lib/format';
import {
  CORRECTIVE_WINDOW_DAYS,
  DOCUMENT_TYPE_LABELS,
  MAINTENANCE_TYPE_LABELS,
  blockingReservations,
  type VehicleUiAction,
} from '../../../../lib/vehicle-status';
import { RENEWAL_HINT } from '../../../../lib/document-status';
import styles from '../../admin-page.module.css';
import { FormDialog } from '../../form-dialog';

// Dialogos de las acciones de un vehiculo (docs/persistence/10-DECISIONES.md #137). Fechas en la
// zona de la sucursal del vehiculo. Mantenimiento, dano y fuera de servicio muestran ANTES de
// confirmar las reservas que dejarian sin auto (misma regla que el API, que vuelve a verificar
// y responde 409 VEHICLE_HAS_ACTIVE_BOOKINGS si algo cambio mientras tanto).
const DAY_MS = 24 * 60 * 60 * 1000;

export type VehicleDialog =
  | { kind: 'action'; action: VehicleUiAction }
  | { kind: 'upload-document' }
  | { kind: 'complete-maintenance'; maintenanceId: string };

interface DialogProps {
  vehicle: VehicleDetail;
  timeZone: string;
  onClose: () => void;
}

function useRunVehicleAction(vehicleId: string, onDone: () => void) {
  const mutation = useVehicleAction(vehicleId);
  const [error, setError] = useState<string | null>(null);
  async function run(input: VehicleActionInput) {
    setError(null);
    try {
      await mutation.mutateAsync(input);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }
  return { run, error, setError, pending: mutation.isPending };
}

function BlockingReservations({
  reservations,
  timeZone,
}: {
  reservations: VehicleActiveReservation[];
  timeZone: string;
}) {
  if (reservations.length === 0) {
    return null;
  }
  return (
    <Alert tone="danger">
      Estas reservas quedarían sin auto. Cambiales el vehículo o reprogramalas antes de continuar:
      <ul>
        {reservations.map((reservation) => (
          <li key={reservation.id}>
            <Link href={`/reservations/${reservation.id}`}>
              Retiro {formatDateTime(reservation.startDate, timeZone)}
            </Link>
            {reservation.status === 'CheckedOut' ? ' (en alquiler)' : ''}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function toUtc(local: string, timeZone: string): { iso?: string; error?: string } {
  if (!local) {
    return {};
  }
  try {
    return { iso: zonedLocalToUtcIso(local, timeZone) };
  } catch (caught) {
    return { error: apiErrorMessage(caught) };
  }
}

function ScheduleMaintenanceDialog({ vehicle, timeZone, onClose }: DialogProps) {
  const { run, error, pending } = useRunVehicleAction(vehicle.id, onClose);
  const [type, setType] = useState<MaintenanceType>('Preventive');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const startUtc = toUtc(start, timeZone);
  const endUtc = toUtc(end, timeZone);
  const rangeError =
    startUtc.error ??
    endUtc.error ??
    (startUtc.iso && endUtc.iso && startUtc.iso >= endUtc.iso
      ? 'El fin tiene que ser posterior al inicio.'
      : undefined);
  const blocking = endUtc.iso
    ? blockingReservations(vehicle.activeReservations, new Date(endUtc.iso))
    : [];
  const valid = Boolean(startUtc.iso && endUtc.iso) && !rangeError && blocking.length === 0;

  return (
    <FormDialog
      title="Programar mantenimiento"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Programar"
      submitDisabled={!valid}
      onSubmit={() =>
        valid &&
        void run({
          action: 'maintenance',
          body: { type, scheduledStart: startUtc.iso!, scheduledEnd: endUtc.iso! },
        })
      }
    >
      <Select
        label="Tipo"
        value={type}
        onChange={(event) => setType(event.target.value as MaintenanceType)}
        options={Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <div className={styles.formRow}>
        <TextField
          label="Inicio"
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          hint={`Hora de ${timeZone}`}
        />
        <TextField
          label="Fin"
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          hint={`Hora de ${timeZone}`}
          error={rangeError}
        />
      </div>
      <p className={styles.muted}>
        El vehículo deja de estar disponible desde ahora hasta que se complete el mantenimiento.
      </p>
      <BlockingReservations reservations={blocking} timeZone={timeZone} />
    </FormDialog>
  );
}

function ReportDamageDialog({ vehicle, timeZone, onClose }: DialogProps) {
  const { run, error, pending } = useRunVehicleAction(vehicle.id, onClose);
  const [severity, setSeverity] = useState<DamageSeverityLevel>('Minor');
  const [reason, setReason] = useState('');
  const [now] = useState(() => Date.now());
  const blocking = blockingReservations(
    vehicle.activeReservations,
    severity === 'Minor' ? new Date(now + CORRECTIVE_WINDOW_DAYS * DAY_MS) : null,
  );

  return (
    <FormDialog
      title="Reportar daño"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Reportar"
      submitDisabled={blocking.length > 0}
      onSubmit={() =>
        void run({
          action: 'report-damage',
          body: { severity, reason: reason.trim() || undefined },
        })
      }
    >
      <Select
        label="Gravedad"
        value={severity}
        onChange={(event) => setSeverity(event.target.value as DamageSeverityLevel)}
        options={[
          { value: 'Minor', label: 'Leve: mantenimiento correctivo' },
          { value: 'Severe', label: 'Grave: fuera de servicio' },
        ]}
      />
      <TextField
        label="Detalle (opcional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <p className={styles.muted}>
        {severity === 'Minor'
          ? `Se programa un mantenimiento correctivo de ${CORRECTIVE_WINDOW_DAYS} días desde ahora.`
          : 'El vehículo queda fuera de servicio hasta que se programe y complete una reparación.'}
      </p>
      <BlockingReservations reservations={blocking} timeZone={timeZone} />
    </FormDialog>
  );
}

function OutOfServiceDialog({ vehicle, timeZone, onClose }: DialogProps) {
  const { run, error, pending } = useRunVehicleAction(vehicle.id, onClose);
  const [reason, setReason] = useState('');
  const blocking = blockingReservations(vehicle.activeReservations, null);

  return (
    <FormDialog
      title="Marcar fuera de servicio"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Marcar fuera de servicio"
      submitDisabled={blocking.length > 0}
      onSubmit={() =>
        void run({ action: 'mark-out-of-service', body: { reason: reason.trim() || undefined } })
      }
    >
      <TextField
        label="Motivo (opcional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <BlockingReservations reservations={blocking} timeZone={timeZone} />
    </FormDialog>
  );
}

function EnableDialog({ vehicle, onClose }: DialogProps) {
  const { run, error, pending } = useRunVehicleAction(vehicle.id, onClose);
  return (
    <ConfirmDialog
      open
      title="Habilitar vehículo"
      message={
        <>
          El vehículo pasa a estar disponible para reservas. Requiere al menos un documento
          verificado y vigente.
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </>
      }
      confirmLabel="Habilitar"
      cancelLabel="Volver"
      loading={pending}
      onConfirm={() => void run({ action: 'enable' })}
      onCancel={onClose}
    />
  );
}

function UploadDocumentDialog({ vehicle, timeZone, onClose }: DialogProps) {
  const { run, error, setError, pending } = useRunVehicleAction(vehicle.id, onClose);
  const upload = useUploadFile();
  const [documentType, setDocumentType] = useState<VehicleDocumentType>('PropertyCard');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const busy = pending || upload.isPending;

  async function submit() {
    if (!file || !expiry) {
      return;
    }
    setError(null);
    let expiryDate: string;
    let fileId: string;
    try {
      // Vence al final de ese dia, en la zona de la sucursal del vehiculo.
      expiryDate = zonedLocalToUtcIso(`${expiry}T23:59`, timeZone);
      fileId = await upload.mutateAsync(file);
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return;
    }
    await run({ action: 'documents', body: { documentType, fileId, expiryDate } });
  }

  return (
    <FormDialog
      title="Cargar documento"
      onClose={onClose}
      error={error}
      pending={busy}
      submitLabel="Cargar"
      submitDisabled={!file || !expiry}
      onSubmit={() => void submit()}
    >
      <Select
        label="Tipo"
        value={documentType}
        onChange={(event) => setDocumentType(event.target.value as VehicleDocumentType)}
        options={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <TextField
        label="Vencimiento"
        type="date"
        value={expiry}
        onChange={(event) => setExpiry(event.target.value)}
      />
      <FileInput
        label="Archivo"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hint="PDF o imagen, hasta 20 MB."
        onFileChange={setFile}
      />
      <Alert tone="info">{RENEWAL_HINT}</Alert>
    </FormDialog>
  );
}

function CompleteMaintenanceDialog({
  vehicle,
  maintenanceId,
  onClose,
}: DialogProps & { maintenanceId: string }) {
  const { run, error, pending } = useRunVehicleAction(vehicle.id, onClose);
  const [fit, setFit] = useState('true');
  return (
    <FormDialog
      title="Completar mantenimiento"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Completar"
      onSubmit={() =>
        void run({
          action: 'complete-maintenance',
          maintenanceId,
          body: { fitForService: fit === 'true' },
        })
      }
    >
      <Select
        label="Resultado de la verificación"
        value={fit}
        onChange={(event) => setFit(event.target.value)}
        options={[
          { value: 'true', label: 'Apto: vuelve a estar disponible' },
          { value: 'false', label: 'No apto: se programa otro mantenimiento' },
        ]}
      />
    </FormDialog>
  );
}

export function VehicleDialogs({ dialog, ...props }: DialogProps & { dialog: VehicleDialog }) {
  if (dialog.kind === 'upload-document') {
    return <UploadDocumentDialog {...props} />;
  }
  if (dialog.kind === 'complete-maintenance') {
    return <CompleteMaintenanceDialog {...props} maintenanceId={dialog.maintenanceId} />;
  }
  switch (dialog.action) {
    case 'enable':
      return <EnableDialog {...props} />;
    case 'schedule-maintenance':
      return <ScheduleMaintenanceDialog {...props} />;
    case 'report-damage':
      return <ReportDamageDialog {...props} />;
    case 'mark-out-of-service':
      return <OutOfServiceDialog {...props} />;
  }
}
