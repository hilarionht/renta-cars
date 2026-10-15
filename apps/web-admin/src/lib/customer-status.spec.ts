import type { IdentityDocument, ReservationListItem } from '@frontend/domain-types';

import {
  canVerifyDocument,
  displayCustomerStatus,
  displayDocumentStatus,
  documentsOwnedBy,
  driverActions,
  hasValidLicense,
  reservationsAuthorizingDriver,
} from './customer-status';

// docs/persistence/10-DECISIONES.md #139.
const NOW = new Date('2026-10-15T12:00:00.000Z');
const FUTURE = '2027-10-15T00:00:00.000Z';
const PAST = '2026-10-14T00:00:00.000Z';

function doc(overrides: Partial<IdentityDocument>): IdentityDocument {
  return {
    id: 'd1',
    ownerType: 'Customer',
    ownerId: 'c1',
    documentType: 'NationalId',
    fileId: 'f1',
    expiryDate: FUTURE,
    status: 'Pending',
    extractedByOcr: false,
    ...overrides,
  };
}

describe('displayCustomerStatus', () => {
  it('bloqueado gana sobre el estado', () => {
    expect(displayCustomerStatus({ status: 'Active', blockStatus: 'Blocked' }).label).toBe(
      'Bloqueado',
    );
    expect(displayCustomerStatus({ status: 'Active', blockStatus: 'None' }).tone).toBe('success');
    expect(displayCustomerStatus({ status: 'Registered', blockStatus: 'None' }).tone).toBe(
      'warning',
    );
  });
});

describe('documentos', () => {
  it('Replaced se muestra como historial aunque este vencido', () => {
    expect(displayDocumentStatus(doc({ status: 'Replaced', expiryDate: PAST }), NOW).label).toBe(
      'Reemplazado',
    );
  });

  it('un Verified con la fecha pasada figura vencido', () => {
    expect(displayDocumentStatus(doc({ status: 'Verified', expiryDate: PAST }), NOW).label).toBe(
      'Vencido',
    );
  });

  it('solo se verifica un Pending vigente', () => {
    expect(canVerifyDocument(doc({}), NOW)).toBe(true);
    expect(canVerifyDocument(doc({ expiryDate: PAST }), NOW)).toBe(false);
    expect(canVerifyDocument(doc({ status: 'Replaced' }), NOW)).toBe(false);
    expect(canVerifyDocument(doc({ status: 'Verified' }), NOW)).toBe(false);
  });

  it('separa los documentos por dueno', () => {
    const documents = [
      doc({ id: 'own' }),
      doc({ id: 'a', ownerType: 'AdditionalDriver', ownerId: 'drv-1' }),
      doc({ id: 'b', ownerType: 'AdditionalDriver', ownerId: 'drv-2' }),
    ];
    expect(documentsOwnedBy(documents, { type: 'Customer' }).map((d) => d.id)).toEqual(['own']);
    expect(
      documentsOwnedBy(documents, { type: 'AdditionalDriver', id: 'drv-2' }).map((d) => d.id),
    ).toEqual(['b']);
  });
});

describe('conductores', () => {
  const driverDoc = (overrides: Partial<IdentityDocument>) =>
    doc({ ownerType: 'AdditionalDriver', ownerId: 'drv-1', status: 'Verified', ...overrides });

  it('la licencia vigente tiene que ser DriversLicense verificada y no vencida', () => {
    expect(hasValidLicense('drv-1', [driverDoc({ documentType: 'NationalId' })], NOW)).toBe(false);
    expect(
      hasValidLicense(
        'drv-1',
        [driverDoc({ documentType: 'DriversLicense', expiryDate: PAST })],
        NOW,
      ),
    ).toBe(false);
    expect(hasValidLicense('drv-1', [driverDoc({ documentType: 'DriversLicense' })], NOW)).toBe(
      true,
    );
  });

  it('acciones segun estado', () => {
    expect(driverActions({ id: 'x', name: 'A', status: 'Registered' })).toEqual([
      'validate',
      'revoke',
    ]);
    expect(driverActions({ id: 'x', name: 'A', status: 'Validated' })).toEqual(['revoke']);
    expect(driverActions({ id: 'x', name: 'A', status: 'Revoked' })).toEqual([]);
  });

  it('lista las reservas donde el conductor esta autorizado', () => {
    const reservations = [
      { id: 'r1', authorizedDriverIds: ['drv-1'] },
      { id: 'r2', authorizedDriverIds: [] },
    ] as unknown as ReservationListItem[];
    expect(reservationsAuthorizingDriver(reservations, 'drv-1').map((r) => r.id)).toEqual(['r1']);
  });
});
