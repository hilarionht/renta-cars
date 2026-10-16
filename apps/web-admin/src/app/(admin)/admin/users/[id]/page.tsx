'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useBranches,
  useCurrentUser,
  usePermissions,
  useRoles,
  useUser,
  useUserAction,
  type UserActionInput,
} from '@frontend/data-access-web';
import type { Role, StaffUser } from '@frontend/domain-types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  PageHeader,
  Select,
  Spinner,
  Table,
  TextField,
  type TableColumn,
} from '@frontend/ui-kit-web';

import { ROLE_STATUS, USER_STATUS } from '../../../../../lib/admin-labels';
import { apiErrorMessage } from '../../../../../lib/api-error-message';
import styles from '../../../admin-page.module.css';
import { FormDialog } from '../../../form-dialog';

// Detalle de un usuario del personal (docs/persistence/10-DECISIONES.md #140). El API protege
// al ultimo administrador (409 LAST_ADMINISTRATOR) y los cambios de rol o sucursal llegan al
// token del usuario en su proximo refresh (hasta 15 minutos).
type UserDialog = 'edit' | 'assign-role' | 'disable' | 'change-password';

function useRunUserAction(userId: string, onDone: () => void) {
  const mutation = useUserAction(userId);
  const [error, setError] = useState<string | null>(null);
  async function run(input: UserActionInput) {
    setError(null);
    try {
      await mutation.mutateAsync(input);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }
  return { run, error, pending: mutation.isPending };
}

function EditDialog({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { run, error, pending } = useRunUserAction(user.id, onClose);
  const branches = useBranches();
  const [name, setName] = useState(user.name);
  const [branchId, setBranchId] = useState(user.branchId ?? '');
  const valid = name.trim().length >= 2;
  return (
    <FormDialog
      title="Editar usuario"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Guardar"
      submitDisabled={!valid}
      onSubmit={() =>
        valid &&
        void run({
          action: 'update',
          body: {
            name: name.trim() !== user.name ? name.trim() : undefined,
            branchId:
              branchId === (user.branchId ?? '') ? undefined : branchId === '' ? null : branchId,
          },
        })
      }
    >
      <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
      <Select
        label="Sucursal"
        value={branchId}
        onChange={(event) => setBranchId(event.target.value)}
        placeholder="Toda la empresa"
        options={(branches.data ?? [])
          .filter((branch) => branch.status === 'Active' || branch.id === user.branchId)
          .map((branch) => ({ value: branch.id, label: branch.name }))}
      />
    </FormDialog>
  );
}

function AssignRoleDialog({
  user,
  roles,
  onClose,
}: {
  user: StaffUser;
  roles: readonly Role[];
  onClose: () => void;
}) {
  const { run, error, pending } = useRunUserAction(user.id, onClose);
  const available = roles.filter(
    (role) => role.status === 'Active' && !user.roles.includes(role.id),
  );
  const [roleId, setRoleId] = useState('');
  return (
    <FormDialog
      title="Asignar rol"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Asignar"
      submitDisabled={!roleId}
      onSubmit={() => roleId && void run({ action: 'assign-role', roleId })}
    >
      <Select
        label="Rol"
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
        placeholder="Elegí un rol"
        options={available.map((role) => ({ value: role.id, label: role.roleName }))}
      />
    </FormDialog>
  );
}

function DisableDialog({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { run, error, pending } = useRunUserAction(user.id, onClose);
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      title="Deshabilitar usuario"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Deshabilitar"
      onSubmit={() => void run({ action: 'disable', body: { reason: reason.trim() || undefined } })}
    >
      <p>{user.name} no va a poder entrar ni renovar su sesión. Se puede reactivar después.</p>
      <TextField
        label="Motivo (opcional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

function ChangePasswordDialog({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { run, error, pending } = useRunUserAction(user.id, onClose);
  const [password, setPassword] = useState('');
  const valid = password.length >= 12;
  return (
    <FormDialog
      title="Cambiar contraseña"
      onClose={onClose}
      error={error}
      pending={pending}
      submitLabel="Cambiar"
      submitDisabled={!valid}
      onSubmit={() =>
        valid && void run({ action: 'change-password', body: { newPassword: password } })
      }
    >
      <TextField
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="Al menos 12 caracteres."
      />
    </FormDialog>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser(id);
  const roles = useRoles();
  const branches = useBranches();
  const me = useCurrentUser();
  const permissions = usePermissions();
  const quick = useUserAction(id);
  const [dialog, setDialog] = useState<UserDialog | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<Role | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const data = user.data;
  if (user.isLoading) {
    return <Spinner />;
  }
  if (user.error || !data) {
    return (
      <>
        <Link href="/admin/users" className={styles.back}>
          ← Usuarios
        </Link>
        <Alert tone="danger">No se encontró el usuario.</Alert>
      </>
    );
  }

  const isSelf = me.data?.id === data.id;
  const isActive = data.status === 'Active';
  const status = USER_STATUS[data.status] ?? { label: data.status, tone: 'neutral' as const };
  const assigned = (roles.data ?? []).filter((role) => data.roles.includes(role.id));
  const branchName = data.branchId
    ? (branches.data?.find((branch) => branch.id === data.branchId)?.name ?? '—')
    : 'Toda la empresa';

  async function runQuick(input: UserActionInput) {
    setActionError(null);
    try {
      await quick.mutateAsync(input);
    } catch (caught) {
      setActionError(apiErrorMessage(caught));
    }
  }

  const roleColumns: readonly TableColumn<Role>[] = [
    { key: 'name', header: 'Rol', render: (row) => row.roleName },
    {
      key: 'scope',
      header: 'Tipo',
      render: (row) => (row.scope === 'System' ? 'De sistema' : 'De la empresa'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const roleStatus = ROLE_STATUS[row.status];
        return <Badge tone={roleStatus.tone}>{roleStatus.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        permissions.has('users:revoke-role') ? (
          <Button variant="ghost" onClick={() => setConfirmRevoke(row)}>
            Quitar
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Link href="/admin/users" className={styles.back}>
        ← Usuarios
      </Link>
      <PageHeader
        title={data.name}
        description={data.email}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className={styles.actions}>
        {permissions.has('users:edit') ? (
          <Button variant="secondary" onClick={() => setDialog('edit')}>
            Editar
          </Button>
        ) : null}
        {permissions.has('users:change-password') ? (
          <Button variant="secondary" onClick={() => setDialog('change-password')}>
            Cambiar contraseña
          </Button>
        ) : null}
        {isActive && permissions.has('users:disable') ? (
          <Button variant="danger" onClick={() => setDialog('disable')}>
            Deshabilitar
          </Button>
        ) : null}
        {!isActive && permissions.has('users:reactivate') ? (
          <Button onClick={() => void runQuick({ action: 'reactivate' })} loading={quick.isPending}>
            Reactivar
          </Button>
        ) : null}
      </div>

      {isSelf ? (
        <div className={styles.section}>
          <Alert tone="info">
            Es tu propio usuario. La empresa siempre conserva al menos un administrador: el sistema
            no te deja quitarte el último rol de administración ni deshabilitarte si sos el único.
          </Alert>
        </div>
      ) : null}
      {actionError ? (
        <div className={styles.section}>
          <Alert tone="danger">{actionError}</Alert>
        </div>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Email</dt>
            <dd>{data.email}</dd>
          </div>
          <div>
            <dt>Sucursal</dt>
            <dd>{branchName}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <h2 className={styles.sectionTitle}>Roles</h2>
          {permissions.has('users:assign-role') ? (
            <Button variant="secondary" onClick={() => setDialog('assign-role')}>
              Asignar rol
            </Button>
          ) : null}
        </div>
        <Table
          columns={roleColumns}
          rows={assigned}
          rowKey={(row) => row.id}
          isLoading={roles.isLoading}
          emptyMessage="Sin roles: el usuario no puede hacer nada."
        />
        <p className={styles.muted}>
          Los cambios de roles y de sucursal se aplican en la próxima renovación de su sesión (hasta
          15 minutos).
        </p>
      </section>

      {dialog === 'edit' ? <EditDialog user={data} onClose={() => setDialog(null)} /> : null}
      {dialog === 'assign-role' ? (
        <AssignRoleDialog user={data} roles={roles.data ?? []} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'disable' ? <DisableDialog user={data} onClose={() => setDialog(null)} /> : null}
      {dialog === 'change-password' ? (
        <ChangePasswordDialog user={data} onClose={() => setDialog(null)} />
      ) : null}
      {confirmRevoke ? (
        <ConfirmDialog
          open
          title={`Quitar el rol ${confirmRevoke.roleName}`}
          message={`${data.name} pierde los permisos de este rol.`}
          confirmLabel="Quitar"
          cancelLabel="Volver"
          tone="danger"
          loading={quick.isPending}
          onConfirm={() => {
            const roleId = confirmRevoke.id;
            setConfirmRevoke(null);
            void runQuick({ action: 'revoke-role', roleId });
          }}
          onCancel={() => setConfirmRevoke(null)}
        />
      ) : null}
    </>
  );
}
