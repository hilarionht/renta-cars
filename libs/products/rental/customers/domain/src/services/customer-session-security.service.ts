import { CustomerSession } from '../entities/customer-session';
import type { CustomerDeviceContext } from '../value-objects/customer-device-context';
import type { CustomerRefreshTokenHash } from '../value-objects/customer-refresh-token-hash';

export interface CustomerRotateParams {
  // La CustomerSession cuyo refresh_token_hash coincide con el token presentado - el
  // llamador (application/) ya la busco por hash (unico globalmente) antes de invocar este
  // servicio.
  matchedSession: CustomerSession;
  // Todas las CustomerSession en estado Active del mismo customer - necesarias para
  // revocarlas TODAS si el token presentado resulta ser un reuso (no solo la afectada).
  activeSessionsForCustomer: CustomerSession[];
  newRefreshTokenHash: CustomerRefreshTokenHash;
  deviceContext: CustomerDeviceContext;
}

export interface CustomerRotateOutcome {
  newSession?: CustomerSession;
  sessionsToSave: CustomerSession[];
  theftDetected: boolean;
}

// Espejo deliberado de libs/platform/identity/domain/src/services/session-security.service.ts
// - duplicado a proposito (Fase 5 cliente-autogestion, docs/persistence/10-DECISIONES.md
// #109), no una abstraccion compartida: extraer el algoritmo a una interfaz estructural
// compartida exigiria que el mecanismo de staff (ya probado, en produccion) dependiera de
// una abstraccion nueva junto con el de customers - el costo de esa abstraccion contradice
// la razon misma de elegir "paralela" (cero riesgo sobre el mecanismo existente).
//
// INV-C01 (equivalente a INV-015 de Session, misma criticidad roja): un refreshTokenHash
// que corresponde a una CustomerSession que YA NO esta Active (Rotated o Revoked) dispara
// SIEMPRE el camino de robo, sin excepcion ni reintento - revoca TODAS las sesiones activas
// del customer, no solo la afectada.
export class CustomerSessionSecurityService {
  rotate(params: CustomerRotateParams): CustomerRotateOutcome {
    const { matchedSession, activeSessionsForCustomer, newRefreshTokenHash, deviceContext } =
      params;

    if (matchedSession.status !== 'Active') {
      const revoked = activeSessionsForCustomer.map((session) => {
        session.revoke('refresh_token_reuse');
        return session;
      });
      return { sessionsToSave: revoked, theftDetected: true };
    }

    matchedSession.markRotated();
    const newSession = CustomerSession.issue({
      customerId: matchedSession.customerId,
      companyId: matchedSession.companyId,
      refreshTokenHash: newRefreshTokenHash,
      deviceContext,
    });

    return { newSession, sessionsToSave: [matchedSession, newSession], theftDetected: false };
  }

  revokeAllForCustomer(sessions: CustomerSession[], reason: string): CustomerSession[] {
    return sessions
      .filter((session) => session.status === 'Active')
      .map((session) => {
        session.revoke(reason);
        return session;
      });
  }
}
