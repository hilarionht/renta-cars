'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useCreateVehicleCategory, useVehicleCategories } from '@frontend/data-access-web';
import type { VehicleCategoryRef } from '@frontend/domain-types';
import {
  Alert,
  Button,
  PageHeader,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { apiErrorMessage } from '../../../../lib/api-error-message';
import { FormDialog } from '../../form-dialog';

// Categorias de vehiculo (docs/persistence/10-DECISIONES.md #137). El listado del API trae solo
// id y nombre; las tarifas se ven en el detalle.
const COLUMNS: readonly TableColumn<VehicleCategoryRef>[] = [
  { key: 'name', header: 'Categoría', render: (row) => row.name },
];

function CreateCategoryDialog({ onClose }: { onClose: (createdId?: string) => void }) {
  const create = useCreateVehicleCategory();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const { id } = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose(id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <FormDialog
      title="Nueva categoría"
      onClose={() => onClose()}
      error={error}
      pending={create.isPending}
      submitLabel="Crear"
      submitDisabled={name.trim().length < 2}
      onSubmit={() => void submit()}
    >
      <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
      <TextField
        label="Descripción (opcional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </FormDialog>
  );
}

export default function VehicleCategoriesPage() {
  const router = useRouter();
  const categories = useVehicleCategories();
  const [creating, setCreating] = useState(false);
  const rows = [...(categories.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Categorías"
        actions={
          <Can permission="vehicle-categories:manage">
            <Button onClick={() => setCreating(true)}>Nueva categoría</Button>
          </Can>
        }
      />
      {categories.error ? (
        <Alert tone="danger">No se pudieron cargar las categorías.</Alert>
      ) : (
        <Table
          columns={COLUMNS}
          rows={categories.data ? rows : undefined}
          rowKey={(row) => row.id}
          isLoading={categories.isLoading}
          emptyMessage="Todavía no hay categorías."
          onRowClick={(row) => router.push(`/fleet/categories/${row.id}`)}
        />
      )}
      {creating ? (
        <CreateCategoryDialog
          onClose={(createdId) => {
            setCreating(false);
            if (createdId) {
              router.push(`/fleet/categories/${createdId}`);
            }
          }}
        />
      ) : null}
    </>
  );
}
