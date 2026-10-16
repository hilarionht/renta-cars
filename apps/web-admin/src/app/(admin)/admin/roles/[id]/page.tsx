'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  usePermissionCatalog,
  usePermissions,
  useRoleAction,
  useRoles,
} from '@frontend/data-access-web';
import { Alert, Badge, Button, ConfirmDialog, PageHeader, Spinner } from '@frontend/ui-kit-web';

import { ROLE_STATUS } from '../../../../../lib/admin-labels';
import { apiErrorMessage } from '../../../../../lib/api-error-message';
import styles from '../../../admin-page.module.css';
import { PermissionPicker } from '../permission-picker';

// Detalle de un rol (docs/persistence/10-DECISIONES.md #140). Los de sistema son de solo lectura.
// El API rechaza dejar a la empresa sin administrador (409 LAST_ADMINISTRATOR) y desactivar un rol
// con usuarios (409 ROLE_HAS_USERS). Desactivar no tiene vuelta atras.
export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const permissions = usePermissions();
  const action = useRoleAction(id);
  const role = roles.data?.find((candidate) => candidate.id === id);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (roles.isLoading) {
    return <Spinner />;
  }
  if (!role) {
    return (
      <>
        <Link href="/admin/roles" className={styles.back}>
          ← Roles
        </Link>
        <Alert tone="danger">No se encontró el rol.</Alert>
      </>
    );
  }

  const editable =
    role.scope === 'Custom' &&
    role.status === 'Active' &&
    permissions.has('roles:edit-permissions');
  const selected = draft ?? role.permissions;
  const dirty =
    draft !== null &&
    (draft.length !== role.permissions.length ||
      draft.some((key) => !role.permissions.includes(key)));
  const status = ROLE_STATUS[role.status];

  async function save() {
    if (!draft) {
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await action.mutateAsync({ action: 'edit-permissions', body: { permissions: draft } });
      setDraft(null);
      setSaved(true);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function deactivate() {
    setConfirmDeactivate(false);
    setError(null);
    try {
      await action.mutateAsync({ action: 'deactivate' });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Link href="/admin/roles" className={styles.back}>
        ← Roles
      </Link>
      <PageHeader
        title={role.roleName}
        description={role.scope === 'System' ? 'Rol de sistema (no se puede modificar)' : undefined}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {editable || (role.scope === 'Custom' && role.status === 'Active') ? (
        <div className={styles.actions}>
          {editable ? (
            <Button
              onClick={() => void save()}
              disabled={!dirty || selected.length === 0}
              loading={action.isPending}
            >
              Guardar permisos
            </Button>
          ) : null}
          {editable && dirty ? (
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Descartar cambios
            </Button>
          ) : null}
          {permissions.has('roles:deactivate') ? (
            <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>
              Desactivar
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className={styles.section}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {saved ? (
        <div className={styles.section}>
          <Alert tone="success">Permisos guardados. Se aplican enseguida.</Alert>
        </div>
      ) : null}
      {editable && selected.length === 0 ? (
        <div className={styles.section}>
          <Alert tone="warning">Un rol necesita al menos un permiso.</Alert>
        </div>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Permisos ({selected.length})</h2>
        <PermissionPicker
          catalog={catalog.data ?? []}
          selected={selected}
          onChange={(next) => {
            setSaved(false);
            setDraft(next);
          }}
          readOnly={!editable}
        />
      </section>

      <ConfirmDialog
        open={confirmDeactivate}
        title={`Desactivar ${role.roleName}`}
        message="Un rol desactivado no se puede volver a activar. Si tiene usuarios asignados, primero hay que reasignarlos."
        confirmLabel="Desactivar"
        cancelLabel="Volver"
        tone="danger"
        loading={action.isPending}
        onConfirm={() => void deactivate()}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}
