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

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1. Registro declarativo
// (mapa, no codigo imperativo) de docs/technical/09-CODING-STANDARDS.md SS3: cada modulo
// de negocio agrega sus propias entradas cuando declara sus DomainError. Vacio a proposito
// en este paso (9 de docs/engineering/10-BOOTSTRAP-PLAN.md) - todavia no existe ningun
// modulo de negocio.
export const DOMAIN_ERROR_REGISTRY = Symbol('DomainErrorRegistry');

export const emptyDomainErrorRegistryProvider: Provider = {
  provide: DOMAIN_ERROR_REGISTRY,
  useValue: new Map<DomainErrorConstructor, DomainErrorMapping>(),
};
