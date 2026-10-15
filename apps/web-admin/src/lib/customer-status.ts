import type {
  AdditionalDriver,
  IdentityDocument,
  ReservationListItem,
} from '@frontend/domain-types';

import { isDocumentExpired } from './document-status';
import type { BadgeToneName } from './reservation-status';

// Estados de un cliente, sus documentos y conductores en la web (docs/persistence/
// 10-DECISIONES.md #139). Replican las reglas de libs/products/rental/customers/domain; el API
// sigue siendo quien decide.
export interface DisplayStatus {
  label: string;
  tone: BadgeToneName;
}

export function displayCustomerStatus(customer: {
  status: string;
  blockStatus: string;
}): DisplayStatus {
  if (customer.blockStatus === 'Blocked') {
    return { label: 'Bloqueado', tone: 'danger' };
  }
  return customer.status === 'Active'
    ? { label: 'Activo', tone: 'success' }
    : { label: 'Documentación pendiente', tone: 'warning' };
}

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  Individual: 'Persona',
  Corporate: 'Empresa',
};

export const IDENTITY_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  NationalId: 'DNI',
  DriversLicense: 'Licencia de conducir',
};

export const DRIVER_STATUS: Record<string, DisplayStatus> = {
  Registered: { label: 'Sin validar', tone: 'warning' },
  Validated: { label: 'Validado', tone: 'success' },
  Revoked: { label: 'Revocado', tone: 'danger' },
};

// Licencia vigente de un conductor: DriversLicense verificada y no vencida (#139, C2).
export function hasValidLicense(
  driverId: string,
  documents: readonly IdentityDocument[],
  now = new Date(),
): boolean {
  return documents.some(
    (document) =>
      document.ownerType === 'AdditionalDriver' &&
      document.ownerId === driverId &&
      document.documentType === 'DriversLicense' &&
      document.status === 'Verified' &&
      !isDocumentExpired(document, now),
  );
}

export function documentsOwnedBy(
  documents: readonly IdentityDocument[],
  owner: { type: 'Customer' } | { type: 'AdditionalDriver'; id: string },
): IdentityDocument[] {
  return documents.filter((document) =>
    owner.type === 'Customer'
      ? document.ownerType === 'Customer'
      : document.ownerType === 'AdditionalDriver' && document.ownerId === owner.id,
  );
}

// Validar la licencia solo tiene sentido si el conductor no esta validado ni revocado.
export function driverActions(driver: AdditionalDriver): ('validate' | 'revoke')[] {
  if (driver.status === 'Revoked') {
    return [];
  }
  return driver.status === 'Registered' ? ['validate', 'revoke'] : ['revoke'];
}

// Reservas activas donde el conductor esta autorizado: revocarlo hace que su check-out falle
// (DRIVER_NOT_VALIDATED) mientras siga autorizado (#139, D).
export function reservationsAuthorizingDriver(
  reservations: readonly ReservationListItem[] | undefined,
  driverId: string,
): ReservationListItem[] {
  return (reservations ?? []).filter((reservation) =>
    reservation.authorizedDriverIds.includes(driverId),
  );
}
