import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import { BranchNotFoundError } from '@platform/branches/domain';

export const BRANCHES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    BranchNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Sucursal no encontrada' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
