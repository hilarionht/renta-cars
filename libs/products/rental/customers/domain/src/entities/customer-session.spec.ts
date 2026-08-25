import { CustomerSession } from './customer-session';
import { CustomerDeviceContext } from '../value-objects/customer-device-context';
import { CustomerRefreshTokenHash } from '../value-objects/customer-refresh-token-hash';

const deviceContext = CustomerDeviceContext.from({ userAgent: 'jest', ipAddress: '127.0.0.1' });

describe('CustomerSession', () => {
  it('issue() crea una sesion Active y emite CustomerSessionCreated.v1', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });

    expect(session.status).toBe('Active');
    expect(session.customerId).toBe('customer-1');
    expect(session.companyId).toBe('company-1');
    expect(session.isNew).toBe(true);
    expect(session.pullDomainEvents()).toEqual([
      {
        eventType: 'CustomerSessionCreated.v1',
        customerSessionId: session.id.toString(),
        customerId: 'customer-1',
        deviceUserAgent: 'jest',
        deviceIpAddress: '127.0.0.1',
      },
    ]);
  });

  it('pullDomainEvents() vacia la cola tras leerla', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });

    session.pullDomainEvents();

    expect(session.pullDomainEvents()).toHaveLength(0);
  });

  it('markRotated() pasa a Rotated y sube la version, sin emitir evento', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });
    session.pullDomainEvents();
    const versionBefore = session.version;

    session.markRotated();

    expect(session.status).toBe('Rotated');
    expect(session.version).toBe(versionBefore + 1);
    expect(session.pullDomainEvents()).toHaveLength(0);
  });

  it('revoke() pasa a Revoked y emite CustomerSessionRevoked.v1', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });
    session.pullDomainEvents();

    session.revoke('logout');

    expect(session.status).toBe('Revoked');
    expect(session.pullDomainEvents()).toEqual([
      {
        eventType: 'CustomerSessionRevoked.v1',
        customerSessionId: session.id.toString(),
        customerId: 'customer-1',
        reason: 'logout',
      },
    ]);
  });

  it('revoke() es idempotente - un segundo llamado no emite otro evento ni sube version', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });
    session.pullDomainEvents();
    session.revoke('logout');
    session.pullDomainEvents();
    const versionAfterFirstRevoke = session.version;

    session.revoke('logout_again');

    expect(session.version).toBe(versionAfterFirstRevoke);
    expect(session.pullDomainEvents()).toHaveLength(0);
  });

  it('markPersisted() apaga isNew', () => {
    const session = CustomerSession.issue({
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
    });

    session.markPersisted();

    expect(session.isNew).toBe(false);
  });

  it('reconstitute() reconstruye una sesion existente sin marcarla nueva ni emitir eventos', () => {
    const session = CustomerSession.reconstitute({
      id: CustomerSession.issue({
        customerId: 'customer-1',
        companyId: 'company-1',
        refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
        deviceContext,
      }).id,
      customerId: 'customer-1',
      companyId: 'company-1',
      refreshTokenHash: CustomerRefreshTokenHash.fromHash('hash-1'),
      deviceContext,
      status: 'Active',
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    expect(session.isNew).toBe(false);
    expect(session.pullDomainEvents()).toHaveLength(0);
  });
});
