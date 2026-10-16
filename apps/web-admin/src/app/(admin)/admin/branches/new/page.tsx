'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { useCreateBranch } from '@frontend/data-access-web';
import { Alert, Button, PageHeader } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../../lib/api-error-message';
import styles from '../../../admin-page.module.css';
import { BranchFields, branchFormErrors, branchFormToRequest, useBranchForm } from '../branch-form';

// Alta de sucursal (docs/persistence/10-DECISIONES.md #140).
export default function NewBranchPage() {
  const router = useRouter();
  const create = useCreateBranch();
  const [form, setForm] = useBranchForm();
  const [error, setError] = useState<string | null>(null);
  const errors = branchFormErrors(form);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (errors.length > 0) {
      return;
    }
    setError(null);
    try {
      const { id } = await create.mutateAsync(branchFormToRequest(form));
      router.push(`/admin/branches/${id}`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Link href="/admin/branches" className={styles.back}>
        ← Sucursales
      </Link>
      <PageHeader title="Nueva sucursal" />
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        <BranchFields form={form} onChange={setForm} />
        {errors.length > 0 ? <Alert tone="warning">{errors.join(' ')}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className={styles.formActions}>
          <Button type="submit" disabled={errors.length > 0} loading={create.isPending}>
            Crear sucursal
          </Button>
        </div>
      </form>
    </>
  );
}
