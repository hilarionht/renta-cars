import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import {
  DuplicateRoleNameError,
  EmptyPermissionSetError,
  LastAdministratorError,
  RoleNotFoundError,
  SystemRoleImmutableError,
} from '@platform/roles-permissions/domain';

// docs/technical/09-CODING-STANDARDS.md SS3: mapa declarativo, mergeado en AppModule via
// domainErrorRegistryProvider(...) - nunca un switch creciente en el filter global.
export const ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #140 (patron de #137): VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  // #140 (decision del usuario): la company siempre conserva un administrador.
  [
    LastAdministratorError,
    {
      status: 409,
      code: 'LAST_ADMINISTRATOR',
      title: 'La empresa se quedaria sin administrador',
    },
  ],
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
