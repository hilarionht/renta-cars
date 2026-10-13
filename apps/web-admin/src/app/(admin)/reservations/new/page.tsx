'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { zonedLocalToUtcIso } from '@frontend/data-access-core';
import {
  useAvailableVehicles,
  useBranches,
  useCreateReservation,
  useCustomerSearch,
  usePermissions,
  useWebAuth,
} from '@frontend/data-access-web';
import type { CustomerListItem } from '@frontend/domain-types';
import { Alert, Badge, Button, PageHeader, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import { useDebouncedValue } from '../../../../lib/use-debounced-value';
import styles from '../reservations.module.css';

// Nueva reserva (docs/persistence/10-DECISIONES.md #135). Las fechas se ingresan en la zona
// horaria de la sucursal elegida y viajan al API en UTC. Se anticipan los errores comunes:
// cliente bloqueado o sin registro completo (422 CUSTOMER_NOT_ELIGIBLE al confirmar) y
// sucursal cerrada (409 BRANCH_CLOSED: solo se listan las activas).
function customerWarning(customer: CustomerListItem): string | null {
  if (customer.blockStatus === 'Blocked') {
    return 'Bloqueado';
  }
  if (customer.status !== 'Active') {
    return 'Registro incompleto';
  }
  return null;
}

// Convierte las fechas de pared; devuelve el error en lugar de lanzar para mostrarlo en el
// formulario.
function toUtcRange(
  start: string,
  end: string,
  timeZone: string | undefined,
): { range?: { startDate: string; endDate: string }; error?: string } {
  if (!start || !end || !timeZone) {
    return {};
  }
  try {
    const range = {
      startDate: zonedLocalToUtcIso(start, timeZone),
      endDate: zonedLocalToUtcIso(end, timeZone),
    };
    if (range.startDate >= range.endDate) {
      return { error: 'La devolución tiene que ser posterior al retiro.' };
    }
    return { range };
  } catch (error) {
    return { error: apiErrorMessage(error) };
  }
}

export default function NewReservationPage() {
  const router = useRouter();
  const { api } = useWebAuth();
  const permissions = usePermissions();
  const canConfirm = permissions.has('reservations:confirm');

  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState<CustomerListItem | null>(null);
  const [branchId, setBranchId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [confirmNow, setConfirmNow] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const customers = useCustomerSearch(useDebouncedValue(query));
  const branches = useBranches();
  const activeBranches = (branches.data ?? []).filter((branch) => branch.status === 'Active');
  const branch = activeBranches.find((candidate) => candidate.id === branchId);
  const { range, error: rangeError } = toUtcRange(start, end, branch?.timeZone);
  const vehicles = useAvailableVehicles({ ...range, branchId: branchId || undefined });
  const createReservation = useCreateReservation();

  const customerBlocked = customer?.blockStatus === 'Blocked';
  const canSubmit = Boolean(customer && !customerBlocked && range && vehicleId) && !submitting;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!customer || !range || !vehicleId) {
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { id } = await createReservation.mutateAsync({
        customerId: customer.id,
        vehicleId,
        ...range,
      });
      if (canConfirm && confirmNow) {
        try {
          await api.request<void>(`/api/v1/reservations/${id}/confirm`, { method: 'POST' });
        } catch (error) {
          setDraftId(id);
          setSubmitError(
            `La reserva quedó en borrador: no se pudo confirmar. ${apiErrorMessage(error)}`,
          );
          return;
        }
      }
      router.push(`/reservations/${id}`);
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link href="/reservations" className={styles.back}>
        ← Reservas
      </Link>
      <PageHeader title="Nueva reserva" />
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        <fieldset className={styles.fieldset}>
          <legend>Cliente</legend>
          {customer ? (
            <div className={styles.actions}>
              <span>
                {customer.name} · {customer.taxIdOrDocumentId}
              </span>
              {customerWarning(customer) ? (
                <Badge tone={customerBlocked ? 'danger' : 'warning'}>
                  {customerWarning(customer)}
                </Badge>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setCustomer(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <TextField
                label="Buscar por nombre, documento, email o teléfono"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                hint="Al menos 2 caracteres."
                autoComplete="off"
              />
              {customers.error ? (
                <Alert tone="danger">No se pudo buscar clientes.</Alert>
              ) : (
                <ul className={styles.choiceList} aria-label="Resultados">
                  {(customers.data?.data ?? []).map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        className={styles.choice}
                        disabled={candidate.blockStatus === 'Blocked'}
                        onClick={() => setCustomer(candidate)}
                      >
                        <span>
                          {candidate.name} · {candidate.taxIdOrDocumentId}
                        </span>
                        {customerWarning(candidate) ? (
                          <Badge tone={candidate.blockStatus === 'Blocked' ? 'danger' : 'warning'}>
                            {customerWarning(candidate)}
                          </Badge>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {query.trim().length >= 2 && customers.data?.data.length === 0 ? (
                    <li className={styles.muted}>Sin resultados.</li>
                  ) : null}
                </ul>
              )}
            </>
          )}
          {customer && customer.status !== 'Active' && !customerBlocked ? (
            <Alert tone="warning">
              El cliente tiene el registro incompleto: la reserva se puede crear, pero no se va a
              poder confirmar hasta completarlo.
            </Alert>
          ) : null}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Sucursal y fechas</legend>
          <Select
            label="Sucursal"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setVehicleId('');
            }}
            placeholder="Elegí una sucursal"
            options={activeBranches.map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
            }))}
          />
          <div className={styles.formRow}>
            <TextField
              label="Retiro"
              type="datetime-local"
              value={start}
              onChange={(event) => {
                setStart(event.target.value);
                setVehicleId('');
              }}
              hint={branch ? `Hora de ${branch.timeZone}` : undefined}
            />
            <TextField
              label="Devolución"
              type="datetime-local"
              value={end}
              onChange={(event) => {
                setEnd(event.target.value);
                setVehicleId('');
              }}
              hint={branch ? `Hora de ${branch.timeZone}` : undefined}
              error={rangeError}
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Vehículo</legend>
          {!range || !branchId ? (
            <p className={styles.muted}>Elegí sucursal y fechas para ver los disponibles.</p>
          ) : vehicles.error ? (
            <Alert tone="danger">{apiErrorMessage(vehicles.error)}</Alert>
          ) : vehicles.isLoading ? (
            <p className={styles.muted}>Buscando vehículos…</p>
          ) : vehicles.data?.length === 0 ? (
            <p className={styles.muted}>No hay vehículos disponibles en ese período.</p>
          ) : (
            <ul className={styles.choiceList} aria-label="Vehículos disponibles">
              {(vehicles.data ?? []).map((vehicle) => (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    className={[
                      styles.choice,
                      vehicle.id === vehicleId ? styles.choiceSelected : '',
                    ].join(' ')}
                    aria-pressed={vehicle.id === vehicleId}
                    onClick={() => setVehicleId(vehicle.id)}
                  >
                    <span>{vehicle.licensePlate}</span>
                    <span className={styles.muted}>{vehicle.vehicleCategory?.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {canConfirm ? (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={confirmNow}
              onChange={(event) => setConfirmNow(event.target.checked)}
            />
            Confirmar al crear (bloquea el vehículo en esas fechas)
          </label>
        ) : null}

        {submitError ? (
          <Alert tone="danger">
            {submitError}{' '}
            {draftId ? <Link href={`/reservations/${draftId}`}>Ver reserva</Link> : null}
          </Alert>
        ) : null}

        <div className={styles.formActions}>
          <Button type="submit" disabled={!canSubmit || Boolean(draftId)} loading={submitting}>
            Crear reserva
          </Button>
        </div>
      </form>
    </>
  );
}
