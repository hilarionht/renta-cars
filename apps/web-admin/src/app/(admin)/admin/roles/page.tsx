'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useCreateRole, usePermissionCatalog, useRoles } from '@frontend/data-access-web';
import type { Role } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { ROLE_STATUS } from '../../../../lib/admin-labels';
import { apiErrorMessage } from '../../../../lib/api-error-message';
import { FormDialog } from '../../form-dialog';
import { PermissionPicker } from './permission-picker';

// Roles (docs/persistence/10-DECISIONES.md #140): los de la empresa y los de sistema (globales e
// inmutables). El nombre es unico sin distinguir mayusculas y no puede copiar uno de sistema.
function CreateRoleDialog({ onClose }: { onClose: (createdId?: string) => void }) {
  const create = useCreateRole();
  const catalog = usePermissionCatalog();
  const [roleName, setRoleName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const valid = roleName.trim().length >= 2 && permissions.length > 0;

  async function submit() {
    if (!valid) {
      return;
    }
    setError(null);
    try {
      const { id } = await create.mutateAsync({ roleName: roleName.trim(), permissions });
      onClose(id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <FormDialog
      title="Nuevo rol"
      onClose={() => onClose()}
      error={error}
      pending={create.isPending}
      submitLabel="Crear"
      submitDisabled={!valid}
      onSubmit={() => void submit()}
    >
      <TextField
        label="Nombre"
        value={roleName}
        onChange={(event) => setRoleName(event.target.value)}
      />
      <PermissionPicker
        catalog={catalog.data ?? []}
        selected={permissions}
        onChange={setPermissions}
      />
    </FormDialog>
  );
}

const COLUMNS: readonly TableColumn<Role>[] = [
  { key: 'name', header: 'Rol', render: (row) => row.roleName },
  {
    key: 'scope',
    header: 'Tipo',
    render: (row) => (row.scope === 'System' ? 'De sistema' : 'De la empresa'),
  },
  { key: 'permissions', header: 'Permisos', render: (row) => row.permissions.length },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => {
      const status = ROLE_STATUS[row.status];
      return <Badge tone={status.tone}>{status.label}</Badge>;
    },
  },
];

export default function RolesPage() {
  const router = useRouter();
  const roles = useRoles();
  const [creating, setCreating] = useState(false);
  // Primero los de la empresa; dentro de cada grupo, por nombre.
  const rows = [...(roles.data ?? [])].sort(
    (a, b) =>
      Number(a.scope === 'System') - Number(b.scope === 'System') ||
      a.roleName.localeCompare(b.roleName, 'es'),
  );

  return (
    <>
      <PageHeader
        title="Roles"
        actions={
          <Can permission="roles:create">
            <Button onClick={() => setCreating(true)}>Nuevo rol</Button>
          </Can>
        }
      />
      {roles.error ? (
        <Alert tone="danger">No se pudieron cargar los roles.</Alert>
      ) : (
        <Table
          columns={COLUMNS}
          rows={roles.data ? rows : undefined}
          rowKey={(row) => row.id}
          isLoading={roles.isLoading}
          emptyMessage="No hay roles."
          onRowClick={(row) => router.push(`/admin/roles/${row.id}`)}
        />
      )}
      {creating ? (
        <CreateRoleDialog
          onClose={(createdId) => {
            setCreating(false);
            if (createdId) {
              router.push(`/admin/roles/${createdId}`);
            }
          }}
        />
      ) : null}
    </>
  );
}
