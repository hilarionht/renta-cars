'use client';

import { Button, Checkbox } from '@frontend/ui-kit-web';

import { groupPermissions, permissionActionLabel } from '../../../../lib/admin-labels';
import styles from '../../admin-page.module.css';

// docs/persistence/10-DECISIONES.md #140: permisos de un rol agrupados por modulo, con el codigo
// como ayuda. readOnly para los roles System (inmutables) y los desactivados.
export function PermissionPicker({
  catalog,
  selected,
  onChange,
  readOnly = false,
}: {
  catalog: readonly string[];
  selected: readonly string[];
  onChange?: (selected: string[]) => void;
  readOnly?: boolean;
}) {
  const chosen = new Set(selected);
  function toggle(keys: string[], on: boolean) {
    const next = new Set(chosen);
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
    onChange?.([...next].sort());
  }

  return (
    <div className={styles.form}>
      {groupPermissions(catalog).map((group) => {
        const all = group.permissions.every((key) => chosen.has(key));
        return (
          <fieldset key={group.key} className={styles.fieldset}>
            <legend>{group.label}</legend>
            {readOnly ? null : (
              <div className={styles.actions}>
                <Button variant="ghost" onClick={() => toggle(group.permissions, !all)}>
                  {all ? 'Quitar todos' : 'Marcar todos'}
                </Button>
              </div>
            )}
            {group.permissions.map((key) => (
              <Checkbox
                key={key}
                label={permissionActionLabel(key)}
                hint={key}
                checked={chosen.has(key)}
                disabled={readOnly}
                onChange={(event) => toggle([key], event.target.checked)}
              />
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
