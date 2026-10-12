import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import { CompanyNotFoundError, DuplicateTaxIdError } from '@platform/companies/domain';

export const COMPANIES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
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
