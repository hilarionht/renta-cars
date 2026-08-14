import type { Provider } from '@nestjs/common';

import type { DomainError } from '@platform/shared-kernel';

export interface DomainErrorMapping {
  status: number;
  code: string;
  title: string;
}

// Constructor de una subclase de DomainError - patron estandar de TypeScript para "una
// clase que extiende X" (misma tecnica que usan las libs de tipos del propio lenguaje).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DomainErrorConstructor = new (...args: any[]) => DomainError;

export type DomainErrorRegistry = ReadonlyMap<DomainErrorConstructor, DomainErrorMapping>;

export type DomainErrorEntries = ReadonlyArray<
  readonly [DomainErrorConstructor, DomainErrorMapping]
>;

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1. Registro declarativo
// (mapa, no codigo imperativo, SS3): cada modulo de negocio exporta su propia lista de
// entradas desde su index.ts (una constante simple, no un provider de Nest) - esta factory
// las mergea en un unico Map. Mecanismo aditivo: un modulo futuro solo agrega su propio
// spread, nunca toca esta funcion.
export const DOMAIN_ERROR_REGISTRY = Symbol('DomainErrorRegistry');

export function mergeDomainErrorRegistry(...entryLists: DomainErrorEntries[]): DomainErrorRegistry {
  return new Map(entryLists.flat());
}

export function domainErrorRegistryProvider(...entryLists: DomainErrorEntries[]): Provider {
  return {
    provide: DOMAIN_ERROR_REGISTRY,
    useValue: mergeDomainErrorRegistry(...entryLists),
  };
}
