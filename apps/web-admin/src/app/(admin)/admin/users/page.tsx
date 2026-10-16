'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Can, useBranches, useCreateUser, useRoles, useUsers } from '@frontend/data-access-web';
import type { StaffUser } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Select,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { USER_STATUS } from '../../../../lib/admin-labels';
import { apiErrorMessage } from '../../../../lib/api-error-message';
import styles from '../../admin-page.module.css';
import { FormDialog } from '../../form-dialog';
import { RolePicker } from './role-picker';

// Usuarios del personal (docs/persistence/10-DECISIONES.md #140): listado paginado y alta. La
// sucursal es opcional (sin sucursal = toda la empresa) y tiene que estar abierta.
const MIN_PASSWORD = 12;

function CreateUserDialog({ onClose }: { onClose: (createdId?: string) => void }) {
  const create = useCreateUser();
  const roles = useRoles();
  const branches = useBranches();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const valid =
    Boolean(email.trim()) &&
    name.trim().length >= 2 &&
    password.length >= MIN_PASSWORD &&
    selectedRoles.length > 0;

  async function submit() {
    if (!valid) {
      return;
    }
    setError(null);
    try {
      const { id } = await create.mutateAsync({
        email: email.trim(),
        name: name.trim(),
        password,
        roles: selectedRoles,
        branchId: branchId || undefined,
      });
      onClose(id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <FormDialog
      title="Nuevo usuario"
      onClose={() => onClose()}
      error={error}
      pending={create.isPending}
      submitLabel="Crear"
      submitDisabled={!valid}
      onSubmit={() => void submit()}
    >
      <div className={styles.formRow}>
        <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="Es el usuario para entrar; no se puede cambiar."
        />
      </div>
      <TextField
        label="Contraseña inicial"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint={`Al menos ${MIN_PASSWORD} caracteres.`}
      />
      <Select
        label="Sucursal"
        value={branchId}
        onChange={(event) => setBranchId(event.target.value)}
        placeholder="Toda la empresa"
        options={(branches.data ?? [])
          .filter((branch) => branch.status === 'Active')
          .map((branch) => ({ value: branch.id, label: branch.name }))}
      />
      <RolePicker roles={roles.data ?? []} selected={selectedRoles} onChange={setSelectedRoles} />
    </FormDialog>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const users = useUsers();
  const roles = useRoles();
  const branches = useBranches();
  const [creating, setCreating] = useState(false);
  const roleName = new Map((roles.data ?? []).map((role) => [role.id, role.roleName]));
  const branchName = new Map((branches.data ?? []).map((branch) => [branch.id, branch.name]));
  const rows = users.data?.pages.flatMap((page) => page.data);

  const columns: readonly TableColumn<StaffUser>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    { key: 'email', header: 'Email', render: (row) => row.email },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => row.roles.map((id) => roleName.get(id) ?? '—').join(', ') || '—',
    },
    {
      key: 'branch',
      header: 'Sucursal',
      render: (row) => (row.branchId ? (branchName.get(row.branchId) ?? '—') : 'Toda la empresa'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const status = USER_STATUS[row.status] ?? { label: row.status, tone: 'neutral' };
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        actions={
          <Can permission="users:create">
            <Button onClick={() => setCreating(true)}>Nuevo usuario</Button>
          </Can>
        }
      />
      {users.error ? (
        <Alert tone="danger">No se pudieron cargar los usuarios.</Alert>
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={users.isLoading}
            emptyMessage="No hay usuarios."
            onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
          />
          {users.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button
                variant="secondary"
                loading={users.isFetchingNextPage}
                onClick={() => void users.fetchNextPage()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </>
      )}
      {creating ? (
        <CreateUserDialog
          onClose={(createdId) => {
            setCreating(false);
            if (createdId) {
              router.push(`/admin/users/${createdId}`);
            }
          }}
        />
      ) : null}
    </>
  );
}
