import { Session } from '../entities/session';
import { DeviceContext } from '../value-objects/device-context';
import { RefreshTokenHash } from '../value-objects/refresh-token-hash';
import { SessionSecurityService } from './session-security.service';

const deviceContext = DeviceContext.from({ userAgent: 'jest', ipAddress: '127.0.0.1' });

function issueSession(userId = 'user-1', companyId = 'company-1'): Session {
  return Session.issue({
    userId,
    companyId,
    refreshTokenHash: RefreshTokenHash.fromHash('initial-hash'),
    deviceContext,
  });
}

describe('SessionSecurityService', () => {
  describe('rotate', () => {
    it('marca la sesion presentada como Rotated y emite una Session Active nueva cuando la sesion presentada esta Active', () => {
      const service = new SessionSecurityService();
      const matchedSession = issueSession();
      matchedSession.markPersisted();

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForUser: [matchedSession],
        newRefreshTokenHash: RefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(false);
      expect(matchedSession.status).toBe('Rotated');
      expect(outcome.newSession).toBeDefined();
      expect(outcome.newSession?.status).toBe('Active');
      expect(outcome.newSession?.userId).toBe(matchedSession.userId);
      expect(outcome.newSession?.companyId).toBe(matchedSession.companyId);
      expect(outcome.sessionsToSave).toEqual([matchedSession, outcome.newSession]);
    });

    it('reusar un refresh_token_hash de una sesion ya Rotated dispara el camino de robo y revoca TODAS las sesiones activas del usuario, no solo la afectada', () => {
      const service = new SessionSecurityService();
      const matchedSession = issueSession('user-1');
      matchedSession.markRotated();

      const otherActiveSession = issueSession('user-1');
      const anotherActiveSession = issueSession('user-1');
      const activeSessionsForUser = [otherActiveSession, anotherActiveSession];

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForUser,
        newRefreshTokenHash: RefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      expect(outcome.newSession).toBeUndefined();
      expect(outcome.sessionsToSave).toHaveLength(2);
      expect(outcome.sessionsToSave.every((session) => session.status === 'Revoked')).toBe(true);
      // La propia sesion "matchedSession" (ya Rotated, no Active) no esta en
      // activeSessionsForUser - el servicio nunca la toca dos veces ni la revoca de nuevo,
      // solo revoca las que SI estaban Active.
      expect(matchedSession.status).toBe('Rotated');
    });

    it('reusar un refresh_token_hash de una sesion ya Revoked (no solo Rotated) tambien dispara el camino de robo', () => {
      const service = new SessionSecurityService();
      const matchedSession = issueSession('user-1');
      matchedSession.revoke('logout');

      const otherActiveSession = issueSession('user-1');

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForUser: [otherActiveSession],
        newRefreshTokenHash: RefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      expect(otherActiveSession.status).toBe('Revoked');
    });

    it('no revoca sesiones que ya estaban Revoked dentro de activeSessionsForUser (revoke() de Session es idempotente)', () => {
      const service = new SessionSecurityService();
      const matchedSession = issueSession('user-1');
      matchedSession.markRotated();

      const alreadyRevoked = issueSession('user-1');
      alreadyRevoked.revoke('logout');
      alreadyRevoked.pullDomainEvents();

      const outcome = service.rotate({
        matchedSession,
        activeSessionsForUser: [alreadyRevoked],
        newRefreshTokenHash: RefreshTokenHash.fromHash('new-hash'),
        deviceContext,
      });

      expect(outcome.theftDetected).toBe(true);
      // revoke() es un no-op si ya estaba Revoked - no debe emitir un segundo evento.
      expect(alreadyRevoked.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('revokeAllForUser', () => {
    it('revoca solo las sesiones Active, deja intactas las que ya no lo estan', () => {
      const service = new SessionSecurityService();
      const active = issueSession('user-1');
      const alreadyRotated = issueSession('user-1');
      alreadyRotated.markRotated();

      const revoked = service.revokeAllForUser([active, alreadyRotated], 'password_changed');

      expect(revoked).toEqual([active]);
      expect(active.status).toBe('Revoked');
      expect(alreadyRotated.status).toBe('Rotated');
    });
  });
});
