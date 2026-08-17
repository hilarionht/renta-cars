import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  AdditionalDriverMissingValidLicenseError,
  AdditionalDriverNotFoundError,
  AdditionalDriverRevokedError,
  CustomerNotFoundError,
  DuplicateActiveIdentityDocumentError,
  IdentityDocumentExpiredError,
  IdentityDocumentNotFoundError,
} from '@rental/customers/domain';

export const CUSTOMERS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    IdentityDocumentExpiredError,
    { status: 409, code: 'IDENTITY_DOCUMENT_EXPIRED', title: 'El documento esta vencido' },
  ],
  [
    AdditionalDriverRevokedError,
    {
      status: 409,
      code: 'ADDITIONAL_DRIVER_REVOKED',
      title: 'El conductor adicional esta revocado',
    },
  ],
  [
    AdditionalDriverMissingValidLicenseError,
    {
      status: 422,
      code: 'ADDITIONAL_DRIVER_MISSING_VALID_LICENSE',
      title: 'El conductor adicional no tiene una licencia vigente',
    },
  ],
  [
    DuplicateActiveIdentityDocumentError,
    {
      status: 409,
      code: 'DUPLICATE_ACTIVE_IDENTITY_DOCUMENT',
      title: 'Ya existe un documento activo de ese tipo para este propietario',
    },
  ],
  [
    CustomerNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Customer no encontrado' },
  ],
  [
    IdentityDocumentNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Identity document no encontrado' },
  ],
  [
    AdditionalDriverNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Additional driver no encontrado' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
