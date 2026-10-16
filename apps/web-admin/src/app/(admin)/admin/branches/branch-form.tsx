'use client';

import { useState } from 'react';

import type { BranchSummary, CreateBranchRequest, DaySchedule } from '@frontend/domain-types';
import { Checkbox, Select, TextField } from '@frontend/ui-kit-web';

import { WEEK_DAYS, WEEK_DAY_LABELS, availableTimeZones } from '../../../../lib/admin-labels';
import styles from '../../admin-page.module.css';

// Formulario de sucursal (docs/persistence/10-DECISIONES.md #140), compartido por alta y edicion.
// La zona horaria se edita aca (pendiente de #135): las fechas de reservas y vehiculos de la
// sucursal se muestran en ella. El API valida cierre posterior a la apertura (400).
export interface BranchFormState {
  name: string;
  line1: string;
  line2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  timeZone: string;
  hours: Record<string, { open: boolean; from: string; to: string }>;
}

export function initialBranchForm(branch?: BranchSummary): BranchFormState {
  const byDay = new Map((branch?.operatingHours ?? []).map((entry) => [entry.day, entry]));
  return {
    name: branch?.name ?? '',
    line1: branch?.address.line1 ?? '',
    line2: branch?.address.line2 ?? '',
    city: branch?.address.city ?? '',
    stateProvince: branch?.address.stateProvince ?? '',
    postalCode: branch?.address.postalCode ?? '',
    country: branch?.address.country ?? 'AR',
    timeZone: branch?.timeZone ?? 'America/Argentina/Buenos_Aires',
    hours: Object.fromEntries(
      WEEK_DAYS.map((day) => {
        const entry = byDay.get(day);
        return [
          day,
          entry
            ? { open: true, from: entry.open, to: entry.close }
            : { open: !branch && day !== 'sunday', from: '09:00', to: '18:00' },
        ];
      }),
    ),
  };
}

// Errores que se ven antes de enviar; el resto lo valida el API.
export function branchFormErrors(form: BranchFormState): string[] {
  const errors: string[] = [];
  if (form.name.trim().length < 2) {
    errors.push('El nombre tiene que tener al menos 2 caracteres.');
  }
  if (!form.line1.trim() || !form.city.trim() || !form.country.trim()) {
    errors.push('Dirección, ciudad y país son obligatorios.');
  }
  for (const day of WEEK_DAYS) {
    const hours = form.hours[day];
    if (hours.open && hours.from >= hours.to) {
      errors.push(`${WEEK_DAY_LABELS[day]}: el cierre tiene que ser posterior a la apertura.`);
    }
  }
  return errors;
}

export function branchFormToRequest(form: BranchFormState): CreateBranchRequest {
  const optional = (value: string) => value.trim() || undefined;
  const operatingHours: DaySchedule[] = WEEK_DAYS.filter((day) => form.hours[day].open).map(
    (day) => ({ day, open: form.hours[day].from, close: form.hours[day].to }),
  );
  return {
    name: form.name.trim(),
    address: {
      line1: form.line1.trim(),
      line2: optional(form.line2),
      city: form.city.trim(),
      stateProvince: optional(form.stateProvince),
      postalCode: optional(form.postalCode),
      country: form.country.trim(),
    },
    operatingHours,
    timeZone: form.timeZone,
  };
}

export function useBranchForm(branch?: BranchSummary) {
  return useState<BranchFormState>(() => initialBranchForm(branch));
}

export function BranchFields({
  form,
  onChange,
}: {
  form: BranchFormState;
  onChange: (form: BranchFormState) => void;
}) {
  const set = (patch: Partial<BranchFormState>) => onChange({ ...form, ...patch });
  const setDay = (day: string, patch: Partial<BranchFormState['hours'][string]>) =>
    set({ hours: { ...form.hours, [day]: { ...form.hours[day], ...patch } } });

  return (
    <>
      <TextField
        label="Nombre"
        value={form.name}
        onChange={(event) => set({ name: event.target.value })}
      />
      <fieldset className={styles.fieldset}>
        <legend>Dirección</legend>
        <div className={styles.formRow}>
          <TextField
            label="Calle y número"
            value={form.line1}
            onChange={(event) => set({ line1: event.target.value })}
          />
          <TextField
            label="Piso / depto (opcional)"
            value={form.line2}
            onChange={(event) => set({ line2: event.target.value })}
          />
        </div>
        <div className={styles.formRow}>
          <TextField
            label="Ciudad"
            value={form.city}
            onChange={(event) => set({ city: event.target.value })}
          />
          <TextField
            label="Provincia (opcional)"
            value={form.stateProvince}
            onChange={(event) => set({ stateProvince: event.target.value })}
          />
          <TextField
            label="Código postal (opcional)"
            value={form.postalCode}
            onChange={(event) => set({ postalCode: event.target.value })}
          />
          <TextField
            label="País"
            value={form.country}
            onChange={(event) => set({ country: event.target.value })}
          />
        </div>
      </fieldset>
      <Select
        label="Zona horaria"
        value={form.timeZone}
        onChange={(event) => set({ timeZone: event.target.value })}
        options={availableTimeZones(form.timeZone).map((zone) => ({ value: zone, label: zone }))}
      />
      <fieldset className={styles.fieldset}>
        <legend>Horario</legend>
        {WEEK_DAYS.map((day) => {
          const hours = form.hours[day];
          return (
            <div key={day} className={styles.formRow}>
              <Checkbox
                label={WEEK_DAY_LABELS[day]}
                checked={hours.open}
                onChange={(event) => setDay(day, { open: event.target.checked })}
              />
              <TextField
                label="Abre"
                type="time"
                value={hours.from}
                disabled={!hours.open}
                onChange={(event) => setDay(day, { from: event.target.value })}
              />
              <TextField
                label="Cierra"
                type="time"
                value={hours.to}
                disabled={!hours.open}
                onChange={(event) => setDay(day, { to: event.target.value })}
              />
            </div>
          );
        })}
      </fieldset>
    </>
  );
}
