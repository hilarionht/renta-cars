import { CustomerSession } from '../entities/customer-session';
import { CustomerDeviceContext } from '../value-objects/customer-device-context';
import { CustomerRefreshTokenHash } from '../value-objects/customer-refresh-token-hash';
import { CustomerSessionSecurityService } from './customer-session-security.service';

const deviceContext = CustomerDeviceContext.from({ userAgent: 'jest', ipAddress: '127.0.0.1' });

function issueSession(customerId = 'customer-1', companyId = 'company-1'): CustomerSession {
  return CustomerSession.issue({
    customerId,
    companyId,
    refreshTokenHash: CustomerRefreshTokenHash.fromHash('initial-hash'),
    deviceContext,
  });
}

describe('CustomerSessionSecurityService', () => {
  describe('rotate', () => {
    it('marca la sesion presentada como Rotated y emite una CustomerSession Active nueva cuando la sesion presentada esta Active', () => {
      const service = new CustomerSessionSecurityService();
      const matchedSession = issueSession();
      matchedSession.markPersisted();

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForCustomer: [matchedSession],
        newRefreshTokenHash: CustomerRefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(false);
      expect(matchedSession.status).toBe('Rotated');
      expect(outcome.newSession).toBeDefined();
      expect(outcome.newSession?.status).toBe('Active');
      expect(outcome.newSession?.customerId).toBe(matchedSession.customerId);
      expect(outcome.newSession?.companyId).toBe(matchedSession.companyId);
      expect(outcome.sessionsToSave).toEqual([matchedSession, outcome.newSession]);
    });

    it('reusar un refresh_token_hash de una sesion ya Rotated dispara el camino de robo y revoca TODAS las sesiones activas del customer, no solo la afectada', () => {
      const service = new CustomerSessionSecurityService();
      const matchedSession = issueSession('customer-1');
      matchedSession.markRotated();

      const otherActiveSession = issueSession('customer-1');
      const anotherActiveSession = issueSession('customer-1');
      const activeSessionsForCustomer = [otherActiveSession, anotherActiveSession];

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForCustomer,
        newRefreshTokenHash: CustomerRefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      expect(outcome.newSession).toBeUndefined();
      expect(outcome.sessionsToSave).toHaveLength(2);
      expect(outcome.sessionsToSave.every((session) => session.status === 'Revoked')).toBe(true);
      // La propia sesion "matchedSession" (ya Rotated, no Active) no esta en
      // activeSessionsForCustomer - el servicio nunca la toca dos veces ni la revoca de nuevo.
      expect(matchedSession.status).toBe('Rotated');
    });

    it('reusar un refresh_token_hash de una sesion ya Revoked (no solo Rotated) tambien dispara el camino de robo', () => {
      const service = new CustomerSessionSecurityService();
      const matchedSession = issueSession('customer-1');
      matchedSession.revoke('logout');

      const otherActiveSession = issueSession('customer-1');

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForCustomer: [otherActiveSession],
        newRefreshTokenHash: CustomerRefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      expect(otherActiveSession.status).toBe('Revoked');
    });

    it('no revoca sesiones que ya estaban Revoked dentro de activeSessionsForCustomer (revoke() de CustomerSession es idempotente)', () => {
      const service = new CustomerSessionSecurityService();
      const matchedSession = issueSession('customer-1');
      matchedSession.markRotated();

      const alreadyRevoked = issueSession('customer-1');
      alreadyRevoked.revoke('logout');
      alreadyRevoked.pullDomainEvents();

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForCustomer: [alreadyRevoked],
        newRefreshTokenHash: CustomerRefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      expect(alreadyRevoked.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('revokeAllForCustomer', () => {
    it('revoca solo las sesiones Active, deja intactas las que ya no lo estan', () => {
      const service = new CustomerSessionSecurityService();
      const active = issueSession('customer-1');
      const alreadyRotated = issueSession('customer-1');
      alreadyRotated.markRotated();

      const revoked = service.revokeAllForCustomer([active, alreadyRotated], 'password_changed');

      expect(revoked).toEqual([active]);
      expect(active.status).toBe('Revoked');
      expect(alreadyRotated.status).toBe('Rotated');
    });
  });
});
