import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import { BranchHasActiveReservationsError, BranchNotFoundError } from '@platform/branches/domain';

export const BRANCHES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #140 (patron de #137): VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  [
    BranchNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Sucursal no encontrada' },
  ],
  // #140 (decision del usuario): no se cierra una sucursal con reservas activas.
  [
    BranchHasActiveReservationsError,
    {
      status: 409,
      code: 'BRANCH_HAS_ACTIVE_RESERVATIONS',
      title: 'La sucursal tiene reservas confirmadas o en curso',
    },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
