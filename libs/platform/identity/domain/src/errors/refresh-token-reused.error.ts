import { DomainError } from '@platform/shared-kernel';

// INV-015 (docs/model/07-INVARIANTS.md SS1, criticidad roja): reuso de un refresh token ya
// rotado (estado Rotated, no Active) dispara siempre el camino de robo, sin excepcion ni
// reintento - revoca TODAS las sesiones activas del usuario, no solo la afectada. El codigo
// HTTP que llega al cliente reutiliza TOKEN_INVALID (401) - nunca se filtra "robo
// detectado" en la respuesta (decision de esta tanda, ver plan).
export class RefreshTokenReusedError extends DomainError {
  constructor(userId: string) {
    super(
      `Refresh token ya rotado reutilizado para el usuario "${userId}" - todas sus sesiones fueron revocadas.`,
    );
  }
}
