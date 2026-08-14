import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  DuplicateRoleNameError,
  EmptyPermissionSetError,
  RoleNotFoundError,
  SystemRoleImmutableError,
} from '@platform/roles-permissions/domain';

// docs/technical/09-CODING-STANDARDS.md SS3: mapa declarativo, mergeado en AppModule via
// domainErrorRegistryProvider(...) - nunca un switch creciente en el filter global.
export const ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    SystemRoleImmutableError,
    { status: 403, code: 'FORBIDDEN', title: 'Role de sistema inmutable' },
  ],
  [
    EmptyPermissionSetError,
    { status: 422, code: 'EMPTY_PERMISSION_SET', title: 'Conjunto de permisos vacio' },
  ],
  [
    DuplicateRoleNameError,
    { status: 409, code: 'RESOURCE_CONFLICT', title: 'Nombre de role duplicado' },
  ],
  [RoleNotFoundError, { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Role no encontrado' }],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
