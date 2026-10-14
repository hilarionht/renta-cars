'use client';

import { type FormEvent, type ReactNode, useState } from 'react';

import { utcIsoToZonedLocal, zonedLocalToUtcIso } from '@frontend/data-access-core';
import {
  useAvailableVehicles,
  usePermissions,
  useReservationAction,
  type ReservationActionInput,
} from '@frontend/data-access-web';
import type { CheckInDamage, DamageSeverity, ReservationDetail } from '@frontend/domain-types';
import { Alert, Button, ConfirmDialog, Dialog, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import type { ReservationUiAction } from '../../../../lib/reservation-status';
import styles from '../reservations.module.css';

// Dialogos de las acciones de una reserva (docs/persistence/10-DECISIONES.md #135). Fechas en
// la zona de la sucursal del vehiculo; check-out/check-in sin fotos (photoFileIds: []).
// Gap aceptado: inspectedBy/cancelledBy los manda el cliente (el id del usuario actual); el
// API no los deriva del token todavia.
interface ActionDialogProps {
  action: ReservationUiAction;
  reservation: ReservationDetail;
  timeZone: string;
  currentUserId: string;
  onClose: () => void;
}

function useRunAction(reservationId: string, onDone: () => void) {
  const mutation = useReservationAction(reservationId);
  const [error, setError] = useState<string | null>(null);
  async function run(input: ReservationActionInput) {
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

function parseInteger(value: string): number | undefined {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

// "1500,50" o "1500.50" -> 150050 unidades minimas. Sin float: se arma desde los digitos.
function parseMoneyToMinorUnits(value: string): number | undefined {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

function FormDialog({
  title,
  onClose,
  onSubmit,
  error,
  pending,
  submitLabel,
  submitDisabled,
  children,
  extraActions,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  children: ReactNode;
  extraActions?: ReactNode;
}) {
  const formId = `form-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          {extraActions}
          <Button type="submit" form={formId} loading={pending} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Dialog>
  );
}

function InspectionFields({
  odometer,
  setOdometer,
  fuel,
  setFuel,
}: {
  odometer: string;
  setOdometer: (value: string) => void;
  fuel: string;
  setFuel: (value: string) => void;
}) {
  const fuelValue = parseInteger(fuel);
  return (
    <div className={styles.formRow}>
      <TextField
        label="Odómetro (km)"
        inputMode="numeric"
        value={odometer}
        onChange={(event) => setOdometer(event.target.value)}
        error={odometer && parseInteger(odometer) === undefined ? 'Número entero.' : undefined}
      />
      <TextField
        label="Combustible (%)"
        inputMode="numeric"
        value={fuel}
        onChange={(event) => setFuel(event.target.value)}
        error={fuel && (fuelValue === undefined || fuelValue > 100) ? 'Entre 0 y 100.' : undefined}
      />
    </div>
  );
}

function CheckOutDialog({ reservation, currentUserId, onClose }: ActionDialogProps) {
  const { run, error, pending } = useRunAction(reservation.id, onClose);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('100');
  const odometerValue = parseInteger(odometer);
  const fuelValue = parseInteger(fuel);
  const valid = odometerValue !== undefined && fuelValue !== undefined && fuelValue <= 100;

  return (
    <FormDialog
      title="Check-out"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Registrar retiro"
      submitDisabled={!valid}
      onSubmit={() =>
        valid &&
        void run({
          action: 'check-out',
          body: {
            odometer: odometerValue,
            fuelLevelPercentage: fuelValue,
            photoFileIds: [],
            inspectedBy: currentUserId,
          },
        })
      }
    >
      <InspectionFields
        odometer={odometer}
        setOdometer={setOdometer}
        fuel={fuel}
        setFuel={setFuel}
      />
      <p className={styles.muted}>Las fotos de la inspección se cargan desde la app móvil.</p>
    </FormDialog>
  );
}

interface DamageDraft {
  description: string;
  severity: DamageSeverity;
  imputableToCustomer: boolean;
  penalty: string;
}

function CheckInDialog({ reservation, currentUserId, onClose }: ActionDialogProps) {
  const { run, error, pending } = useRunAction(reservation.id, onClose);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('');
  const [damages, setDamages] = useState<DamageDraft[]>([]);
  const odometerValue = parseInteger(odometer);
  const fuelValue = parseInteger(fuel);

  const damageErrors = damages.map((damage) => {
    if (!damage.description.trim()) {
      return 'Falta la descripción.';
    }
    if (damage.penalty.trim() && parseMoneyToMinorUnits(damage.penalty) === undefined) {
      return 'Penalidad inválida (ej. 1500 o 1500,50).';
    }
    return null;
  });
  const valid =
    odometerValue !== undefined &&
    fuelValue !== undefined &&
    fuelValue <= 100 &&
    damageErrors.every((damageError) => damageError === null);

  function updateDamage(index: number, patch: Partial<DamageDraft>) {
    setDamages((current) =>
      current.map((damage, i) => (i === index ? { ...damage, ...patch } : damage)),
    );
  }

  function submit() {
    if (!valid) {
      return;
    }
    const body: CheckInDamage[] = damages.map((damage) => ({
      description: damage.description.trim(),
      severity: damage.severity,
      imputableToCustomer: damage.imputableToCustomer,
      photoFileIds: [],
      penaltyAmountMinorUnits: damage.penalty.trim()
        ? parseMoneyToMinorUnits(damage.penalty)
        : undefined,
    }));
    void run({
      action: 'check-in',
      body: {
        odometer: odometerValue,
        fuelLevelPercentage: fuelValue,
        photoFileIds: [],
        inspectedBy: currentUserId,
        damages: body.length > 0 ? body : undefined,
      },
    });
  }

  return (
    <FormDialog
      title="Check-in"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Registrar devolución"
      submitDisabled={!valid}
      onSubmit={submit}
    >
      <InspectionFields
        odometer={odometer}
        setOdometer={setOdometer}
        fuel={fuel}
        setFuel={setFuel}
      />
      {damages.map((damage, index) => (
        <fieldset key={index} className={styles.fieldset}>
          <legend>Daño {index + 1}</legend>
          <TextField
            label="Descripción"
            value={damage.description}
            onChange={(event) => updateDamage(index, { description: event.target.value })}
            error={damageErrors[index] ?? undefined}
          />
          <div className={styles.formRow}>
            <Select
              label="Gravedad"
              value={damage.severity}
              onChange={(event) =>
                updateDamage(index, { severity: event.target.value as DamageSeverity })
              }
              options={[
                { value: 'Minor', label: 'Leve' },
                { value: 'Severe', label: 'Grave' },
              ]}
            />
            <TextField
              label={`Penalidad (${reservation.currency}, opcional)`}
              inputMode="decimal"
              value={damage.penalty}
              onChange={(event) => updateDamage(index, { penalty: event.target.value })}
            />
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={damage.imputableToCustomer}
              onChange={(event) =>
                updateDamage(index, { imputableToCustomer: event.target.checked })
              }
            />
            Imputable al cliente
          </label>
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDamages((current) => current.filter((_, i) => i !== index))}
            >
              Quitar daño
            </Button>
          </div>
        </fieldset>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setDamages((current) => [
              ...current,
              { description: '', severity: 'Minor', imputableToCustomer: true, penalty: '' },
            ])
          }
        >
          Agregar daño
        </Button>
      </div>
    </FormDialog>
  );
}

// Valida y convierte un par de fechas de pared de la sucursal.
function zonedRange(start: string, end: string, timeZone: string) {
  try {
    const startDate = zonedLocalToUtcIso(start, timeZone);
    const endDate = zonedLocalToUtcIso(end, timeZone);
    if (startDate >= endDate) {
      return { error: 'La devolución tiene que ser posterior al retiro.' };
    }
    return { startDate, endDate };
  } catch (caught) {
    return { error: apiErrorMessage(caught) };
  }
}

function RescheduleDialog({ reservation, timeZone, onClose }: ActionDialogProps) {
  const { run, error, pending } = useRunAction(reservation.id, onClose);
  const [start, setStart] = useState(utcIsoToZonedLocal(reservation.startDate, timeZone));
  const [end, setEnd] = useState(utcIsoToZonedLocal(reservation.endDate, timeZone));
  const range =
    start && end ? zonedRange(start, end, timeZone) : { error: 'Completá ambas fechas.' };

  return (
    <FormDialog
      title="Reprogramar"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Reprogramar"
      submitDisabled={Boolean(range.error)}
      onSubmit={() =>
        range.startDate &&
        range.endDate &&
        void run({
          action: 'reschedule',
          body: { newStartDate: range.startDate, newEndDate: range.endDate },
        })
      }
    >
      <div className={styles.formRow}>
        <TextField
          label="Retiro"
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          hint={`Hora de ${timeZone}`}
        />
        <TextField
          label="Devolución"
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          hint={`Hora de ${timeZone}`}
          error={start && end ? range.error : undefined}
        />
      </div>
      <p className={styles.muted}>El monto se recalcula con la tarifa vigente.</p>
    </FormDialog>
  );
}

function ExtendDialog({ reservation, timeZone, onClose }: ActionDialogProps) {
  const permissions = usePermissions();
  const canRequest = permissions.has('reservations:request-extension');
  const canApprove = permissions.has('reservations:approve-extension');
  const { run, error, setError, pending } = useRunAction(reservation.id, onClose);
  const [end, setEnd] = useState(utcIsoToZonedLocal(reservation.endDate, timeZone));

  function newEndDate(): string | undefined {
    try {
      const iso = zonedLocalToUtcIso(end, timeZone);
      if (iso <= reservation.endDate) {
        setError('La nueva devolución tiene que ser posterior a la actual.');
        return undefined;
      }
      return iso;
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return undefined;
    }
  }

  return (
    <FormDialog
      title="Extender alquiler"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel={canApprove ? 'Aprobar extensión' : 'Registrar pedido'}
      onSubmit={() => {
        const iso = newEndDate();
        if (iso) {
          void run(
            canApprove
              ? { action: 'approve-extension', body: { newEndDate: iso } }
              : { action: 'request-extension', body: { requestedNewEndDate: iso } },
          );
        }
      }}
      extraActions={
        canApprove && canRequest ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const iso = newEndDate();
              if (iso) {
                void run({ action: 'request-extension', body: { requestedNewEndDate: iso } });
              }
            }}
          >
            Solo registrar pedido
          </Button>
        ) : null
      }
    >
      <TextField
        label="Nueva devolución"
        type="datetime-local"
        value={end}
        onChange={(event) => setEnd(event.target.value)}
        hint={`Hora de ${timeZone}`}
      />
      <p className={styles.muted}>
        Aprobar cambia la fecha y agrega el ajuste de precio; registrar el pedido solo lo deja
        asentado para que alguien con permiso lo apruebe.
      </p>
    </FormDialog>
  );
}

function SwapVehicleDialog({ reservation, onClose }: ActionDialogProps) {
  const { run, error, pending } = useRunAction(reservation.id, onClose);
  const [now] = useState(() => new Date().toISOString());
  const [newVehicleId, setNewVehicleId] = useState('');
  const [reason, setReason] = useState('');
  // Disponibles para lo que queda del alquiler, en la misma sucursal.
  const remainingStart = now < reservation.endDate ? now : undefined;
  const vehicles = useAvailableVehicles({
    startDate: remainingStart,
    endDate: remainingStart ? reservation.endDate : undefined,
    branchId: reservation.vehicle?.branchId,
  });
  const options = (vehicles.data ?? []).filter((vehicle) => vehicle.id !== reservation.vehicleId);

  return (
    <FormDialog
      title="Cambiar vehículo"
      onClose={onClose}
      error={error ?? (vehicles.error ? apiErrorMessage(vehicles.error) : null)}
      pending={pending}
      submitLabel="Cambiar vehículo"
      submitDisabled={!newVehicleId}
      onSubmit={() =>
        newVehicleId &&
        void run({
          action: 'swap-vehicle',
          body: { newVehicleId, reason: reason.trim() || undefined },
        })
      }
    >
      {!remainingStart ? (
        <Alert tone="warning">El período de la reserva ya terminó.</Alert>
      ) : vehicles.isLoading ? (
        <p className={styles.muted}>Buscando vehículos…</p>
      ) : options.length === 0 ? (
        <p className={styles.muted}>No hay otros vehículos disponibles en la sucursal.</p>
      ) : (
        <Select
          label="Vehículo nuevo"
          value={newVehicleId}
          onChange={(event) => setNewVehicleId(event.target.value)}
          placeholder="Elegí un vehículo"
          options={options.map((vehicle) => ({
            value: vehicle.id,
            label: `${vehicle.licensePlate}${vehicle.vehicleCategory ? ` · ${vehicle.vehicleCategory.name}` : ''}`,
          }))}
        />
      )}
      <TextField
        label="Motivo (opcional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

function SimpleConfirmDialog({ reservation, currentUserId, action, onClose }: ActionDialogProps) {
  const { run, error, pending } = useRunAction(reservation.id, onClose);
  const copy = {
    confirm: {
      title: 'Confirmar reserva',
      message: 'Se bloquea el vehículo en esas fechas y se avisa al cliente.',
      label: 'Confirmar',
      tone: 'primary' as const,
      input: { action: 'confirm' } as ReservationActionInput,
    },
    cancel: {
      title: 'Cancelar reserva',
      message: 'Se libera el vehículo. Puede aplicar la penalidad de la política de cancelación.',
      label: 'Cancelar reserva',
      tone: 'danger' as const,
      input: { action: 'cancel', body: { cancelledBy: currentUserId } } as ReservationActionInput,
    },
    'mark-no-show': {
      title: 'Marcar como no presentado',
      message: 'El cliente no retiró el vehículo. La reserva se cancela y se libera el vehículo.',
      label: 'Marcar no presentado',
      tone: 'danger' as const,
      input: { action: 'mark-no-show' } as ReservationActionInput,
    },
  }[action as 'confirm' | 'cancel' | 'mark-no-show'];

  return (
    <ConfirmDialog
      open
      title={copy.title}
      message={
        <>
          {copy.message}
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </>
      }
      confirmLabel={copy.label}
      cancelLabel="Volver"
      tone={copy.tone}
      loading={pending}
      onConfirm={() => void run(copy.input)}
      onCancel={onClose}
    />
  );
}

export function ReservationActionDialog(props: ActionDialogProps) {
  switch (props.action) {
    case 'check-out':
      return <CheckOutDialog {...props} />;
    case 'check-in':
      return <CheckInDialog {...props} />;
    case 'reschedule':
      return <RescheduleDialog {...props} />;
    case 'extend':
      return <ExtendDialog {...props} />;
    case 'swap-vehicle':
      return <SwapVehicleDialog {...props} />;
    default:
      return <SimpleConfirmDialog {...props} />;
  }
}
