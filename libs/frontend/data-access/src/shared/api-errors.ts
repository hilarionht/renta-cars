// Extraido de auth/api-client.ts a un modulo sin imports propios (a proposito): ambos
// clientes (staff y cliente) y sus specs necesitan estas clases sin arrastrar la cadena de
// imports de ningun cliente concreto (api-client.ts -> secure-token-storage.ts ->
// expo-secure-store, ESM sin transformar fuera de apps/mobile bajo Jest) - importarlas desde
// aca evita que un mock parcial de un cliente concreto tenga que cargar el modulo real.
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
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
