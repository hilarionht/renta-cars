'use client';

import { type FormEvent, type ReactNode, useState } from 'react';

import { useUpdateSettingsPolicy } from '@frontend/data-access-web';
import type {
  CancellationPolicyTier,
  CompanySettings,
  SettingsPolicy,
  SettingsPolicyRequests,
} from '@frontend/domain-types';
import { Alert, Button, Checkbox, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import { parseInteger } from '../../../../lib/form-parsing';
import styles from '../../admin-page.module.css';

// Politicas de la empresa (docs/persistence/10-DECISIONES.md #140): cada una en su formulario,
// con su PATCH propio. El API valida (400 INVALID_VALUE con el detalle) y la web solo evita
// enviar campos vacios. Los topes de recargo y deposito son decision de negocio: no se limitan.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  Card: 'Tarjeta',
  Cash: 'Efectivo',
  Transfer: 'Transferencia',
  DigitalWallet: 'Billetera digital',
};

const CHANNEL_LABELS: Record<string, string> = { WhatsApp: 'WhatsApp', Email: 'Email', SMS: 'SMS' };

function PolicyForm<P extends SettingsPolicy>({
  policy,
  title,
  description,
  canEdit,
  build,
  children,
}: {
  policy: P;
  title: string;
  description?: string;
  canEdit: boolean;
  // Arma el cuerpo, o devuelve un mensaje si falta algo.
  build: () => SettingsPolicyRequests[P] | string;
  children: ReactNode;
}) {
  const update = useUpdateSettingsPolicy(policy);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const body = build();
    if (typeof body === 'string') {
      setError(body);
      return;
    }
    try {
      await update.mutateAsync(body);
      setSaved(true);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <form className={styles.section} onSubmit={(event) => void onSubmit(event)} noValidate>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description ? <p className={styles.muted}>{description}</p> : null}
      <fieldset className={styles.fieldset} disabled={!canEdit}>
        {children}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {saved ? <Alert tone="success">Guardado.</Alert> : null}
        {canEdit ? (
          <div className={styles.formActions}>
            <Button type="submit" variant="secondary" loading={update.isPending}>
              Guardar
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

const required = (label: string, value: string, min = 0): number | string => {
  const parsed = parseInteger(value);
  return parsed === undefined || parsed < min ? `${label}: ingresá un número entero.` : parsed;
};

export function SettingsSections({
  settings,
  canEdit,
}: {
  settings: CompanySettings;
  canEdit: boolean;
}) {
  const [methods, setMethods] = useState(settings.paymentMethodsEnabled);
  const [tiers, setTiers] = useState(
    settings.cancellationPolicyTiers.map((tier) => ({
      hours: String(tier.minHoursBeforeStart),
      penalty: String(tier.penaltyPercentage),
    })),
  );
  const [grace, setGrace] = useState(String(settings.lateReturnGraceMinutes));
  const [latePenalty, setLatePenalty] = useState(
    String(settings.lateReturnPenaltyPercentagePerHour),
  );
  const [depositApplies, setDepositApplies] = useState(settings.depositApplies);
  const [depositPercentage, setDepositPercentage] = useState(
    String(settings.depositPercentageOfTotal),
  );
  const [draftMinutes, setDraftMinutes] = useState(String(settings.draftExpirationMinutes));
  const [leadTime, setLeadTime] = useState(String(settings.minimumBookingLeadTimeMinutes));
  const [reminder, setReminder] = useState(String(settings.reminderLeadTimeMinutes));
  const [channel, setChannel] = useState(settings.notificationChannelPreference);
  const [maintenanceApplies, setMaintenanceApplies] = useState(
    settings.maintenanceThresholdApplies,
  );
  const [maintenanceKm, setMaintenanceKm] = useState(
    settings.maintenanceThresholdOdometerKm?.toString() ?? '',
  );
  const [maintenanceDays, setMaintenanceDays] = useState(
    settings.maintenanceThresholdDays?.toString() ?? '',
  );

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Módulos de producto</h2>
        <p>{settings.enabledProductModules.join(', ')}</p>
        <p className={styles.muted}>
          Solo lectura: quitar Rental bloquearía toda la operación de alquiler.
        </p>
      </section>

      <PolicyForm
        policy="payment-methods-enabled"
        title="Medios de pago"
        canEdit={canEdit}
        build={() =>
          methods.length > 0
            ? { paymentMethodsEnabled: methods }
            : 'Tiene que quedar al menos un medio de pago.'
        }
      >
        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
          <Checkbox
            key={value}
            label={label}
            checked={methods.includes(value)}
            onChange={(event) =>
              setMethods(
                event.target.checked
                  ? [...methods, value]
                  : methods.filter((method) => method !== value),
              )
            }
          />
        ))}
      </PolicyForm>

      <PolicyForm
        policy="cancellation-policy"
        title="Política de cancelación"
        description="Multa según la anticipación con que se cancela. A más anticipación, la multa tiene que ser igual o menor."
        canEdit={canEdit}
        build={() => {
          const parsed: CancellationPolicyTier[] = [];
          for (const tier of tiers) {
            const hours = required('Horas', tier.hours);
            const penalty = required('Multa', tier.penalty);
            if (typeof hours === 'string' || typeof penalty === 'string') {
              return typeof hours === 'string' ? hours : (penalty as string);
            }
            parsed.push({ minHoursBeforeStart: hours, penaltyPercentage: penalty });
          }
          return parsed.length > 0 ? { tiers: parsed } : 'Agregá al menos un tramo.';
        }}
      >
        {tiers.map((tier, index) => (
          <div key={index} className={styles.formRow}>
            <TextField
              label="Desde (horas antes del retiro)"
              inputMode="numeric"
              value={tier.hours}
              onChange={(event) =>
                setTiers(
                  tiers.map((t, i) => (i === index ? { ...t, hours: event.target.value } : t)),
                )
              }
            />
            <TextField
              label="Multa (%)"
              inputMode="numeric"
              value={tier.penalty}
              onChange={(event) =>
                setTiers(
                  tiers.map((t, i) => (i === index ? { ...t, penalty: event.target.value } : t)),
                )
              }
            />
            {canEdit && tiers.length > 1 ? (
              <Button variant="ghost" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>
                Quitar tramo
              </Button>
            ) : null}
          </div>
        ))}
        {canEdit ? (
          <div className={styles.actions}>
            <Button
              variant="ghost"
              onClick={() => setTiers([...tiers, { hours: '', penalty: '' }])}
            >
              Agregar tramo
            </Button>
          </div>
        ) : null}
      </PolicyForm>

      <PolicyForm
        policy="late-return-policy"
        title="Devolución tardía"
        canEdit={canEdit}
        build={() => {
          const graceMinutes = required('Tolerancia', grace);
          const penalty = required('Recargo', latePenalty);
          if (typeof graceMinutes === 'string') return graceMinutes;
          if (typeof penalty === 'string') return penalty;
          return { graceMinutes, penaltyPercentagePerHour: penalty };
        }}
      >
        <div className={styles.formRow}>
          <TextField
            label="Tolerancia (minutos)"
            inputMode="numeric"
            value={grace}
            onChange={(event) => setGrace(event.target.value)}
          />
          <TextField
            label="Recargo por hora (%)"
            inputMode="numeric"
            value={latePenalty}
            onChange={(event) => setLatePenalty(event.target.value)}
          />
        </div>
      </PolicyForm>

      <PolicyForm
        policy="deposit-policy"
        title="Depósito en garantía"
        canEdit={canEdit}
        build={() => {
          const percentage = required('Porcentaje', depositPercentage);
          if (typeof percentage === 'string') return percentage;
          return { applies: depositApplies, percentageOfTotal: percentage };
        }}
      >
        <Checkbox
          label="Se cobra depósito"
          checked={depositApplies}
          onChange={(event) => setDepositApplies(event.target.checked)}
        />
        <TextField
          label="Porcentaje del total (%)"
          inputMode="numeric"
          value={depositPercentage}
          onChange={(event) => setDepositPercentage(event.target.value)}
        />
      </PolicyForm>

      <PolicyForm
        policy="draft-expiration-policy"
        title="Vencimiento de borradores"
        description="Minutos que un borrador de reserva espera la confirmación."
        canEdit={canEdit}
        build={() => {
          const minutes = required('Minutos', draftMinutes, 1);
          return typeof minutes === 'string' ? minutes : { expirationMinutes: minutes };
        }}
      >
        <TextField
          label="Minutos"
          inputMode="numeric"
          value={draftMinutes}
          onChange={(event) => setDraftMinutes(event.target.value)}
        />
      </PolicyForm>

      <PolicyForm
        policy="minimum-booking-lead-time"
        title="Anticipación mínima para reservar"
        canEdit={canEdit}
        build={() => {
          const minutes = required('Minutos', leadTime);
          return typeof minutes === 'string' ? minutes : { leadTimeMinutes: minutes };
        }}
      >
        <TextField
          label="Minutos"
          inputMode="numeric"
          value={leadTime}
          onChange={(event) => setLeadTime(event.target.value)}
        />
      </PolicyForm>

      <PolicyForm
        policy="reminder-lead-time"
        title="Recordatorio de retiro"
        description="Cuántos minutos antes del retiro se avisa al cliente."
        canEdit={canEdit}
        build={() => {
          const minutes = required('Minutos', reminder, 1);
          return typeof minutes === 'string' ? minutes : { leadTimeMinutes: minutes };
        }}
      >
        <TextField
          label="Minutos"
          inputMode="numeric"
          value={reminder}
          onChange={(event) => setReminder(event.target.value)}
        />
      </PolicyForm>

      <PolicyForm
        policy="notification-channel-preference"
        title="Canal de notificación preferido"
        canEdit={canEdit}
        build={() => ({ preferredChannel: channel })}
      >
        <Select
          label="Canal"
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </PolicyForm>

      <PolicyForm
        policy="maintenance-threshold-policy"
        title="Mantenimiento preventivo"
        description="Si aplica, hace falta al menos un umbral: kilómetros o días."
        canEdit={canEdit}
        build={() => {
          const odometerThresholdKm = maintenanceKm.trim()
            ? parseInteger(maintenanceKm)
            : undefined;
          const daysThreshold = maintenanceDays.trim() ? parseInteger(maintenanceDays) : undefined;
          if (
            (maintenanceKm.trim() && odometerThresholdKm === undefined) ||
            (maintenanceDays.trim() && daysThreshold === undefined)
          ) {
            return 'Los umbrales son números enteros.';
          }
          return { applies: maintenanceApplies, odometerThresholdKm, daysThreshold };
        }}
      >
        <Checkbox
          label="Aplica"
          checked={maintenanceApplies}
          onChange={(event) => setMaintenanceApplies(event.target.checked)}
        />
        <div className={styles.formRow}>
          <TextField
            label="Cada (km)"
            inputMode="numeric"
            value={maintenanceKm}
            onChange={(event) => setMaintenanceKm(event.target.value)}
          />
          <TextField
            label="Cada (días)"
            inputMode="numeric"
            value={maintenanceDays}
            onChange={(event) => setMaintenanceDays(event.target.value)}
          />
        </div>
      </PolicyForm>
    </>
  );
}
