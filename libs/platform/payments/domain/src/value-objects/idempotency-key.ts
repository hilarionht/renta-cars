// docs/model/04-VALUE_OBJECTS.md SS6 - "clave de deduplicacion de una operacion de cobro
// (docs/contracts/08-API-CONTRACTS.md SS7)... unica por Payment; su reutilizacion deduplica,
// nunca reprocesa". El VO solo valida forma minima (no vacio) - la deduplicacion real es
// responsabilidad de application/ + UNIQUE(company_id, idempotency_key) (INV-021, doble
// capa).
export class IdempotencyKey {
  private constructor(private readonly value: string) {}

  static from(raw: string): IdempotencyKey {
    if (raw.trim().length === 0) {
      throw new TypeError('IdempotencyKey no puede estar vacia.');
    }
    return new IdempotencyKey(raw);
  }

  toString(): string {
    return this.value;
  }
}
