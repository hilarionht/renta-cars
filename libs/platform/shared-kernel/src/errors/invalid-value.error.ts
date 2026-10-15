import { DomainError } from './domain-error';

// docs/persistence/10-DECISIONES.md #137: un Value Object rechaza un dato de ENTRADA invalido
// (VIN, moneda, rango de fechas...). Antes lanzaban TypeError crudo, que ningun filtro mapea
// y terminaba en 500 (gap anotado en #116). Es DomainError (no TypeError) porque
// DomainExceptionFilter solo consulta el registry para DomainError. Cada modulo que expone un
// VO que la lanza registra su mapeo (400 INVALID_VALUE), mismo criterio que
// UnsupportedExpandError (#123).
//
// Solo para validaciones de entrada: invariantes internas (hashes, EntityId, Money.add con
// monedas distintas) siguen como TypeError, porque si fallan es un bug del servidor (500).
export class InvalidValueError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
