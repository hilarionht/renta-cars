import type { DomainError } from './domain-error';

// Tipos compartidos del registro declarativo de errores de dominio (docs/technical/
// 09-CODING-STANDARDS.md SS3) - cada modulo exporta su propio array de entradas
// (DomainErrorEntries) desde infrastructure/, tipado contra esto. El token de inyeccion y
// el merge en un unico Map viven en apps/api (raiz de composicion, no algo que libs/
// importe) - esto es solo el contrato de forma, para que un modulo pueda construir su
// propio array sin depender de apps/api.
export interface DomainErrorMapping {
  status: number;
  code: string;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DomainErrorConstructor = new (...args: any[]) => DomainError;

export type DomainErrorEntries = ReadonlyArray<
  readonly [DomainErrorConstructor, DomainErrorMapping]
>;
