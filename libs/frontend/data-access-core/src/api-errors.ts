// Errores de API compartidos por todos los clientes (mobile staff, mobile customer y web).
// Modulo sin imports propios a proposito: ningun spec que los use tiene que cargar la cadena
// de un cliente concreto (p.ej. expo-secure-store en mobile). Vive en data-access-core desde
// docs/persistence/10-DECISIONES.md #134; @frontend/data-access lo reexporta.
export class AuthenticationExpiredError extends Error {
  constructor() {
    super('La sesion expiro - inicia sesion de nuevo.');
    this.name = 'AuthenticationExpiredError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // `code` del problem details del API (docs/contracts/07-ERROR-CATALOG.md), p.ej.
    // VEHICLE_NOT_AVAILABLE. Opcional: no todos los errores lo traen.
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
