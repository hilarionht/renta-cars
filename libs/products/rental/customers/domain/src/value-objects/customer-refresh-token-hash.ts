// Espejo de libs/platform/identity/domain/src/value-objects/refresh-token-hash.ts -
// duplicado a proposito, ver customer-session-status.ts. SHA-256, no argon2id: mismo
// razonamiento (alta entropia, deteccion de reuso, no fuerza bruta offline) - el calculo
// real vive en infrastructure/providers, domain/ no importa node:crypto.
export class CustomerRefreshTokenHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): CustomerRefreshTokenHash {
    if (hash.length === 0) {
      throw new TypeError('CustomerRefreshTokenHash no puede estar vacio.');
    }
    return new CustomerRefreshTokenHash(hash);
  }

  equals(other: CustomerRefreshTokenHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
