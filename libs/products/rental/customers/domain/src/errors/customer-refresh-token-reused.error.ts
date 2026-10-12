import { DomainError } from '@platform/shared-kernel';

// Espejo de libs/platform/identity/domain/src/errors/refresh-token-reused.error.ts -
// duplicado a proposito, ver customer-session.ts. INV-C01 (equivalente a INV-015):
// reuso de un refresh token ya rotado dispara siempre el camino de robo, sin excepcion ni
// reintento - revoca TODAS las sesiones activas del customer, no solo la afectada. El
// codigo HTTP que llega al cliente reutiliza TOKEN_INVALID (401) - nunca se filtra "robo
// detectado" en la respuesta.
export class CustomerRefreshTokenReusedError extends DomainError {
  constructor(customerId: string) {
    super(
      `Refresh token ya rotado reutilizado para el customer "${customerId}" - todas sus sesiones fueron revocadas.`,
    );
  }
}
