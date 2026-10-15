'use client';

import Link from 'next/link';
import { useState } from 'react';

import { zonedLocalToUtcIso } from '@frontend/data-access-core';
import {
  useBranchTimeZones,
  useCustomerAction,
  useUpdateCustomer,
  useUploadFile,
  type CustomerActionInput,
} from '@frontend/data-access-web';
import type {
  AdditionalDriver,
  CustomerDetail,
  IdentityDocumentType,
  ReservationListItem,
} from '@frontend/domain-types';
import { Alert, ConfirmDialog, FileInput, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import {
  IDENTITY_DOCUMENT_TYPE_LABELS,
  reservationsAuthorizingDriver,
} from '../../../../lib/customer-status';
import { formatDateTime } from '../../../../lib/format';
import { reservationStatusLabel } from '../../../../lib/reservation-status';
import { FormDialog } from '../../form-dialog';
import { PhoneField, parsePhoneInput } from '../phone-field';

// Dialogos de las acciones de un cliente (docs/persistence/10-DECISIONES.md #139). Bloquear y
// revocar se permiten aunque haya reservas activas (decision del usuario), pero el dialogo las
// muestra ANTES de confirmar: el check-out de esas reservas va a fallar mientras siga asi.
export type CustomerDialog =
  | { kind: 'edit' }
  | { kind: 'block' }
  | { kind: 'unblock' }
  | { kind: 'upload-document'; driver?: AdditionalDriver }
  | { kind: 'register-driver' }
  | { kind: 'revoke-driver'; driver: AdditionalDriver };

interface DialogProps {
  customer: CustomerDetail;
  activeReservations: ReservationListItem[] | undefined;
  onClose: () => void;
}

function useRunCustomerAction(customerId: string, onDone: () => void) {
  const mutation = useCustomerAction(customerId);
  const [error, setError] = useState<string | null>(null);
  async function run(input: CustomerActionInput) {
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

function AffectedReservations({
  reservations,
  message,
}: {
  reservations: ReservationListItem[] | undefined;
  message: string;
}) {
  const timeZoneOf = useBranchTimeZones();
  if (!reservations || reservations.length === 0) {
    return null;
  }
  return (
    <Alert tone="warning">
      {message}
      <ul>
        {reservations.map((reservation) => (
          <li key={reservation.id}>
            <Link href={`/reservations/${reservation.id}`}>
              {reservation.vehicle?.licensePlate ?? 'Reserva'}, retiro{' '}
              {formatDateTime(reservation.startDate, timeZoneOf(reservation.vehicle?.branchId))}
            </Link>{' '}
            ({reservationStatusLabel(reservation.status)})
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function EditDialog({ customer, onClose }: DialogProps) {
  const update = useUpdateCustomer(customer.id);
  const [name, setName] = useState(customer.name);
  const [contactEmail, setContactEmail] = useState(customer.contactEmail);
  const [phoneInput, setPhoneInput] = useState(customer.contactPhone);
  const [error, setError] = useState<string | null>(null);
  const phone = parsePhoneInput(phoneInput);
  const valid = name.trim().length >= 2 && Boolean(contactEmail.trim() && phone.e164);

  async function submit() {
    if (!valid) {
      return;
    }
    setError(null);
    // Solo lo que cambio: el PATCH es parcial.
    const body = {
      name: name.trim() !== customer.name ? name.trim() : undefined,
      contactEmail: contactEmail.trim() !== customer.contactEmail ? contactEmail.trim() : undefined,
      contactPhone: phone.e164 !== customer.contactPhone ? phone.e164 : undefined,
    };
    try {
      await update.mutateAsync(body);
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <FormDialog
      title="Editar cliente"
      onClose={onClose}
      error={error}
      pending={update.isPending}
      submitLabel="Guardar"
      submitDisabled={!valid}
      onSubmit={() => void submit()}
    >
      <TextField
        label="Nombre o razón social"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
      />
      <PhoneField value={phoneInput} onChange={setPhoneInput} />
    </FormDialog>
  );
}

function BlockDialog({ customer, activeReservations, onClose }: DialogProps) {
  const { run, error, pending } = useRunCustomerAction(customer.id, onClose);
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      title="Bloquear cliente"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Bloquear"
      submitDisabled={!reason.trim()}
      onSubmit={() =>
        reason.trim() && void run({ action: 'block', body: { reason: reason.trim() } })
      }
    >
      <TextField
        label="Motivo"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <AffectedReservations
        reservations={activeReservations}
        message="Estas reservas siguen vigentes, pero no se va a poder retirar el vehículo mientras el cliente esté bloqueado:"
      />
    </FormDialog>
  );
}

function UnblockDialog({ customer, onClose }: DialogProps) {
  const { run, error, pending } = useRunCustomerAction(customer.id, onClose);
  return (
    <ConfirmDialog
      open
      title="Desbloquear cliente"
      message={
        <>
          El cliente vuelve a poder reservar y retirar vehículos.
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </>
      }
      confirmLabel="Desbloquear"
      cancelLabel="Volver"
      loading={pending}
      onConfirm={() => void run({ action: 'unblock' })}
      onCancel={onClose}
    />
  );
}

// El cliente no tiene sucursal: el vencimiento se toma al final del dia en la zona del
// navegador del operador.
function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function UploadDocumentDialog({
  customer,
  driver,
  onClose,
}: DialogProps & { driver?: AdditionalDriver }) {
  const { run, error, setError, pending } = useRunCustomerAction(customer.id, onClose);
  const upload = useUploadFile();
  const [documentType, setDocumentType] = useState<IdentityDocumentType>(
    driver ? 'DriversLicense' : 'NationalId',
  );
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
      expiryDate = zonedLocalToUtcIso(`${expiry}T23:59`, browserTimeZone());
      fileId = await upload.mutateAsync(file);
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return;
    }
    await run({
      action: 'identity-documents',
      body: { documentType, fileId, expiryDate, additionalDriverId: driver?.id },
    });
  }

  return (
    <FormDialog
      title={driver ? `Cargar documento de ${driver.name}` : 'Cargar documento'}
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
        onChange={(event) => setDocumentType(event.target.value as IdentityDocumentType)}
        options={Object.entries(IDENTITY_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
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
      <Alert tone="info">
        Si ya hay uno del mismo tipo, el nuevo lo reemplaza recién cuando se verifica. Hasta
        entonces sigue valiendo el anterior.
      </Alert>
    </FormDialog>
  );
}

function RegisterDriverDialog({ customer, onClose }: DialogProps) {
  const { run, error, pending } = useRunCustomerAction(customer.id, onClose);
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;
  return (
    <FormDialog
      title="Agregar conductor"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Agregar"
      submitDisabled={!valid}
      onSubmit={() =>
        valid && void run({ action: 'additional-drivers', body: { name: name.trim() } })
      }
    >
      <TextField
        label="Nombre completo"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <p>Después cargá su licencia de conducir y validala.</p>
    </FormDialog>
  );
}

function RevokeDriverDialog({
  customer,
  driver,
  activeReservations,
  onClose,
}: DialogProps & { driver: AdditionalDriver }) {
  const { run, error, pending } = useRunCustomerAction(customer.id, onClose);
  return (
    <ConfirmDialog
      open
      title={`Revocar a ${driver.name}`}
      message={
        <>
          El conductor deja de estar habilitado para manejar. No se puede deshacer.
          <AffectedReservations
            reservations={reservationsAuthorizingDriver(activeReservations, driver.id)}
            message="Está autorizado en estas reservas: después de revocarlo no se va a poder hacer el retiro de ninguna de ellas."
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </>
      }
      confirmLabel="Revocar"
      cancelLabel="Volver"
      loading={pending}
      onConfirm={() => void run({ action: 'revoke-driver', driverId: driver.id })}
      onCancel={onClose}
    />
  );
}

export function CustomerDialogs({ dialog, ...props }: DialogProps & { dialog: CustomerDialog }) {
  switch (dialog.kind) {
    case 'edit':
      return <EditDialog {...props} />;
    case 'block':
      return <BlockDialog {...props} />;
    case 'unblock':
      return <UnblockDialog {...props} />;
    case 'upload-document':
      return <UploadDocumentDialog {...props} driver={dialog.driver} />;
    case 'register-driver':
      return <RegisterDriverDialog {...props} />;
    case 'revoke-driver':
      return <RevokeDriverDialog {...props} driver={dialog.driver} />;
  }
}
