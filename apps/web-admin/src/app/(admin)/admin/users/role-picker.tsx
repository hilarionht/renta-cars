'use client';

import type { Role } from '@frontend/domain-types';
import { Checkbox } from '@frontend/ui-kit-web';

import styles from '../../admin-page.module.css';

// docs/persistence/10-DECISIONES.md #140: eleccion de roles del usuario. Solo roles activos (el
// API rechaza asignar uno desactivado).
export function RolePicker({
  roles,
  selected,
  onChange,
}: {
  roles: readonly Role[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}) {
  const active = roles.filter((role) => role.status === 'Active');
  return (
    <fieldset className={styles.fieldset}>
      <legend>Roles</legend>
      {active.length === 0 ? <p className={styles.muted}>No hay roles activos.</p> : null}
      {active.map((role) => (
        <Checkbox
          key={role.id}
          label={role.roleName}
          hint={`${role.scope === 'System' ? 'De sistema · ' : ''}${role.permissions.length} permisos`}
          checked={selected.includes(role.id)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? [...selected, role.id]
                : selected.filter((roleId) => roleId !== role.id),
            )
          }
        />
      ))}
    </fieldset>
  );
}
