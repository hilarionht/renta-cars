import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import { CompanyNotFoundError, DuplicateTaxIdError } from '@platform/companies/domain';

export const COMPANIES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #139 (patron de #137): VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  [DuplicateTaxIdError, { status: 409, code: 'DUPLICATE_TAX_ID', title: 'TaxId duplicado' }],
  [
    CompanyNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Company no encontrada' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
