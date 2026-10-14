'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useAddRate, usePermissions, useVehicleCategory } from '@frontend/data-access-web';
import type { RateUnit, VehicleRate } from '@frontend/domain-types';
import {
  Alert,
  Button,
  PageHeader,
  Select,
  Spinner,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../../lib/api-error-message';
import { formatMoney } from '../../../../../lib/format';
import { parseMoneyToMinorUnits } from '../../../../../lib/form-parsing';
import styles from '../../../admin-page.module.css';
import { FormDialog } from '../../../form-dialog';

// Detalle de una categoria con sus tarifas (docs/persistence/10-DECISIONES.md #137). Las
// vigencias son fechas (medianoche UTC), igual que el seed: la tarifa aplica por fecha de la
// reserva, no por hora. Una vigencia que se superpone con otra da 409 RATE_OVERLAP.
const UNIT_LABELS: Record<RateUnit, string> = { Day: 'Por día', Week: 'Por semana' };

function formatDay(iso?: string): string {
  return iso ? iso.slice(0, 10) : 'Sin fin';
}

function AddRateDialog({
  categoryId,
  defaultCurrency,
  onClose,
}: {
  categoryId: string;
  defaultCurrency: string;
  onClose: () => void;
}) {
  const addRate = useAddRate(categoryId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [unit, setUnit] = useState<RateUnit>('Day');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amountMinorUnits = parseMoneyToMinorUnits(amount);
  const amountError =
    amount.trim() && amountMinorUnits === undefined
      ? 'Monto inválido (ej. 45000 o 45000,50).'
      : undefined;
  const valid =
    amountMinorUnits !== undefined && /^[A-Za-z]{3}$/.test(currency.trim()) && validFrom;

  async function submit() {
    if (!valid || amountMinorUnits === undefined) {
      return;
    }
    setError(null);
    try {
      await addRate.mutateAsync({
        amountMinorUnits,
        currency: currency.trim().toUpperCase(),
        unit,
        validFrom: `${validFrom}T00:00:00.000Z`,
        validTo: validTo ? `${validTo}T00:00:00.000Z` : undefined,
      });
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <FormDialog
      title="Agregar tarifa"
      onClose={onClose}
      error={error}
      pending={addRate.isPending}
      submitLabel="Agregar"
      submitDisabled={!valid}
      onSubmit={() => void submit()}
    >
      <div className={styles.formRow}>
        <TextField
          label="Monto"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={amountError}
        />
        <TextField
          label="Moneda"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          hint="Código ISO de 3 letras (ARS, USD...)."
          maxLength={3}
        />
      </div>
      <Select
        label="Unidad"
        value={unit}
        onChange={(event) => setUnit(event.target.value as RateUnit)}
        options={Object.entries(UNIT_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <div className={styles.formRow}>
        <TextField
          label="Vigente desde"
          type="date"
          value={validFrom}
          onChange={(event) => setValidFrom(event.target.value)}
        />
        <TextField
          label="Vigente hasta (opcional)"
          type="date"
          value={validTo}
          onChange={(event) => setValidTo(event.target.value)}
          hint="Vacío: sin fin."
        />
      </div>
    </FormDialog>
  );
}

export default function VehicleCategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const category = useVehicleCategory(id);
  const permissions = usePermissions();
  const [adding, setAdding] = useState(false);

  if (category.isLoading) {
    return <Spinner />;
  }
  const data = category.data;
  if (category.error || !data) {
    return (
      <>
        <Link href="/fleet/categories" className={styles.back}>
          ← Categorías
        </Link>
        <Alert tone="danger">No se encontró la categoría.</Alert>
      </>
    );
  }

  const rates = [...data.rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const columns: readonly TableColumn<VehicleRate>[] = [
    {
      key: 'amount',
      header: 'Monto',
      render: (row) => formatMoney(row.amountMinorUnits, row.currency),
    },
    { key: 'unit', header: 'Unidad', render: (row) => UNIT_LABELS[row.unit] ?? row.unit },
    { key: 'from', header: 'Desde', render: (row) => formatDay(row.validFrom) },
    { key: 'to', header: 'Hasta', render: (row) => formatDay(row.validTo) },
  ];

  return (
    <>
      <Link href="/fleet/categories" className={styles.back}>
        ← Categorías
      </Link>
      <PageHeader
        title={data.name}
        description={data.description}
        actions={
          permissions.has('vehicle-categories:manage') ? (
            <Button onClick={() => setAdding(true)}>Agregar tarifa</Button>
          ) : null
        }
      />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tarifas</h2>
        <Table
          columns={columns}
          rows={rates}
          rowKey={(row) => row.id}
          emptyMessage="Sin tarifas: no se pueden confirmar reservas de esta categoría."
        />
      </section>
      {adding ? (
        <AddRateDialog
          categoryId={data.id}
          defaultCurrency={rates[rates.length - 1]?.currency ?? ''}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
