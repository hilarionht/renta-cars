'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { useRegisterCustomer } from '@frontend/data-access-web';
import type { CustomerType } from '@frontend/domain-types';
import { Alert, Button, PageHeader, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import { CUSTOMER_TYPE_LABELS } from '../../../../lib/customer-status';
import styles from '../../admin-page.module.css';
import { PhoneField, parsePhoneInput } from '../phone-field';

// Alta de cliente (docs/persistence/10-DECISIONES.md #139). Queda con la documentacion
// pendiente: para alquilar hace falta un documento verificado, que se carga desde el detalle.
// Documento y telefono son unicos por empresa (409 si se repiten).
export default function NewCustomerPage() {
  const router = useRouter();
  const register = useRegisterCustomer();
  const [name, setName] = useState('');
  const [taxIdOrDocumentId, setTaxIdOrDocumentId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Individual');
  const [error, setError] = useState<string | null>(null);
  const phone = parsePhoneInput(phoneInput);

  const canSubmit =
    name.trim().length >= 2 &&
    Boolean(taxIdOrDocumentId.trim() && contactEmail.trim() && phone.e164) &&
    !register.isPending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !phone.e164) {
      return;
    }
    setError(null);
    try {
      const { id } = await register.mutateAsync({
        name: name.trim(),
        taxIdOrDocumentId: taxIdOrDocumentId.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: phone.e164,
        customerType,
      });
      router.push(`/customers/${id}`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Link href="/customers" className={styles.back}>
        ← Clientes
      </Link>
      <PageHeader title="Nuevo cliente" />
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className={styles.formRow}>
          <TextField
            label="Nombre o razón social"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <Select
            label="Tipo"
            value={customerType}
            onChange={(event) => setCustomerType(event.target.value as CustomerType)}
            options={Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>
        <div className={styles.formRow}>
          <TextField
            label="Documento o CUIT"
            value={taxIdOrDocumentId}
            onChange={(event) => setTaxIdOrDocumentId(event.target.value)}
            autoComplete="off"
          />
          <TextField
            label="Email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            autoComplete="off"
          />
        </div>
        <PhoneField value={phoneInput} onChange={setPhoneInput} />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className={styles.formActions}>
          <Button type="submit" disabled={!canSubmit} loading={register.isPending}>
            Registrar cliente
          </Button>
        </div>
      </form>
    </>
  );
}
