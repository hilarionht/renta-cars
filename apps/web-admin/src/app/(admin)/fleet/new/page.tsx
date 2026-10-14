'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { useBranches, useRegisterVehicle, useVehicleCategories } from '@frontend/data-access-web';
import { Alert, Button, PageHeader, Select, TextField } from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import styles from '../../admin-page.module.css';

// Alta de vehiculo (docs/persistence/10-DECISIONES.md #137). Queda Registrado: para habilitarlo
// hace falta un documento verificado, que se carga desde el detalle. Patente y VIN los
// normaliza y valida el API (409 si se repiten, 400 INVALID_VALUE si el VIN no es valido).
export default function NewVehiclePage() {
  const router = useRouter();
  const branches = useBranches();
  const categories = useVehicleCategories();
  const register = useRegisterVehicle();
  const [branchId, setBranchId] = useState('');
  const [vehicleCategoryId, setVehicleCategoryId] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vin, setVin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeBranches = (branches.data ?? []).filter((branch) => branch.status === 'Active');
  const canSubmit =
    Boolean(branchId && vehicleCategoryId && licensePlate.trim() && vin.trim()) &&
    !register.isPending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const { id } = await register.mutateAsync({
        branchId,
        vehicleCategoryId,
        licensePlate: licensePlate.trim(),
        vin: vin.trim(),
      });
      router.push(`/fleet/${id}`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Link href="/fleet" className={styles.back}>
        ← Flota
      </Link>
      <PageHeader title="Nuevo vehículo" />
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className={styles.formRow}>
          <Select
            label="Sucursal"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            placeholder="Elegí una sucursal"
            options={activeBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
          <Select
            label="Categoría"
            value={vehicleCategoryId}
            onChange={(event) => setVehicleCategoryId(event.target.value)}
            placeholder="Elegí una categoría"
            options={(categories.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </div>
        <div className={styles.formRow}>
          <TextField
            label="Patente"
            value={licensePlate}
            onChange={(event) => setLicensePlate(event.target.value)}
            autoComplete="off"
          />
          <TextField
            label="VIN"
            value={vin}
            onChange={(event) => setVin(event.target.value)}
            hint="17 caracteres (ISO 3779)."
            autoComplete="off"
          />
        </div>
        {categories.data?.length === 0 ? (
          <Alert tone="warning">
            Primero creá una categoría en la pestaña{' '}
            <Link href="/fleet/categories">Categorías</Link>.
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className={styles.formActions}>
          <Button type="submit" disabled={!canSubmit} loading={register.isPending}>
            Registrar vehículo
          </Button>
        </div>
      </form>
    </>
  );
}
