import { PERMISSION_CATALOG, type PermissionKey } from './permission-catalog';

// docs/model/04-VALUE_OBJECTS.md - una clave de permiso validada contra PERMISSION_CATALOG,
// nunca un string libre. Usado por Role.permissions (docs/model/02-AGGREGATES.md SS2).
export class Permission {
  private constructor(private readonly key: PermissionKey) {}

  static from(raw: string): Permission {
    if (!(PERMISSION_CATALOG as readonly string[]).includes(raw)) {
      throw new TypeError(`Permiso desconocido, no esta en PERMISSION_CATALOG: "${raw}"`);
    }
    return new Permission(raw as PermissionKey);
  }

  equals(other: Permission): boolean {
    return this.key === other.key;
  }

  toString(): PermissionKey {
    return this.key;
  }
}
