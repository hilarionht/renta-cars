'use client';

import { type FormEvent, useState } from 'react';

import { normalizePhoneNumber } from '@frontend/data-access-core';
import {
  useCompany,
  useCompanySettings,
  usePermissions,
  useUpdateCompany,
} from '@frontend/data-access-web';
import type { Company } from '@frontend/domain-types';
import { Alert, Button, PageHeader, Spinner, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import styles from '../../admin-page.module.css';
import { SettingsSections } from './settings-sections';

// Empresa (docs/persistence/10-DECISIONES.md #140): datos de facturacion y configuracion. El CUIT
// no se edita. El telefono se normaliza a E.164 (Argentina por defecto, #139).
function CompanyDetails({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const update = useUpdateCompany();
  const [legalName, setLegalName] = useState(company.legalName);
  const [email, setEmail] = useState(company.billingContactEmail);
  const [phone, setPhone] = useState(company.billingContactPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const normalized = phone.trim() ? normalizePhoneNumber(phone) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (normalized && !normalized.ok) {
      setError(normalized.error);
      return;
    }
    try {
      await update.mutateAsync({
        legalName: legalName.trim() !== company.legalName ? legalName.trim() : undefined,
        billingContactEmail:
          email.trim() !== company.billingContactEmail ? email.trim() : undefined,
        billingContactPhone:
          normalized?.ok && normalized.e164 !== company.billingContactPhone
            ? normalized.e164
            : undefined,
      });
      setSaved(true);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <form className={styles.section} onSubmit={(event) => void onSubmit(event)} noValidate>
      <h2 className={styles.sectionTitle}>Datos</h2>
      <fieldset className={styles.fieldset} disabled={!canEdit}>
        <div className={styles.formRow}>
          <TextField
            label="Razón social"
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
          />
          <TextField label="CUIT" value={company.taxId} disabled hint="No se puede cambiar." />
        </div>
        <div className={styles.formRow}>
          <TextField
            label="Email de facturación"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Teléfono de facturación (opcional)"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={normalized && !normalized.ok ? normalized.error : undefined}
            hint={normalized?.ok ? `Se guarda como ${normalized.e164}` : undefined}
          />
        </div>
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

export default function CompanyPage() {
  const company = useCompany();
  const settings = useCompanySettings();
  const permissions = usePermissions();

  if (company.isLoading || settings.isLoading) {
    return <Spinner />;
  }
  if (company.error || settings.error || !company.data || !settings.data) {
    return <Alert tone="danger">No se pudieron cargar los datos de la empresa.</Alert>;
  }
  return (
    <>
      <PageHeader
        title={company.data.legalName}
        description="Datos y configuración de la empresa"
      />
      <CompanyDetails company={company.data} canEdit={permissions.has('companies:edit')} />
      <SettingsSections settings={settings.data} canEdit={permissions.has('settings:manage')} />
    </>
  );
}
