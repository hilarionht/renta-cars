import { Session } from '../entities/session';
import type { DeviceContext } from '../value-objects/device-context';
import type { RefreshTokenHash } from '../value-objects/refresh-token-hash';

export interface RotateParams {
  // La Session cuyo refresh_token_hash coincide con el token presentado - el llamador
  // (application/) ya la busco por hash (unico globalmente, docs/persistence/
  // 05-INDICES-Y-CONSTRAINTS.md) antes de invocar este servicio.
  matchedSession: Session;
  // Todas las Session en estado Active del mismo usuario - necesarias para revocarlas TODAS
  // si el token presentado resulta ser un reuso (no solo la afectada).
  activeSessionsForUser: Session[];
  newRefreshTokenHash: RefreshTokenHash;
  deviceContext: DeviceContext;
}

export interface RotateOutcome {
  newSession?: Session;
  sessionsToSave: Session[];
  theftDetected: boolean;
}

// Unico domain service que vive en domain/ puro (docs/model/05-DOMAIN_SERVICES.md SS3) -
// orquesta solo instancias de Session, sin puerto cross-modulo. Regla no negociable: un
// refreshTokenHash que corresponde a una Session que YA NO esta Active (Rotated o Revoked)
// dispara siempre el camino de robo, sin excepcion ni reintento - revoca TODAS las sesiones
// activas del usuario, no solo la afectada (INV-015, criticidad roja).
export class SessionSecurityService {
  rotate(params: RotateParams): RotateOutcome {
    const { matchedSession, activeSessionsForUser, newRefreshTokenHash, deviceContext } = params;

    if (matchedSession.status !== 'Active') {
      const revoked = activeSessionsForUser.map((session) => {
        session.revoke('refresh_token_reuse');
        return session;
      });
      return { sessionsToSave: revoked, theftDetected: true };
    }

    matchedSession.markRotated();
    const newSession = Session.issue({
      userId: matchedSession.userId,
      companyId: matchedSession.companyId,
      refreshTokenHash: newRefreshTokenHash,
      deviceContext,
    });

    return { newSession, sessionsToSave: [matchedSession, newSession], theftDetected: false };
  }

  revokeAllForUser(sessions: Session[], reason: string): Session[] {
    return sessions
      .filter((session) => session.status === 'Active')
      .map((session) => {
        session.revoke(reason);
        return session;
      });
  }
}
