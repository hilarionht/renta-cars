// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). SHA-256, no
// argon2id: mismo razonamiento que CustomerRefreshTokenHash, pero aca el motivo es mas
// fuerte todavia - un codigo de 6 digitos tiene 10^6 combinaciones, el control real contra
// fuerza bruta es maxAttempts (CustomerOtpChallenge), no el costo del hash. El calculo real
// vive en infrastructure/providers, domain/ no importa node:crypto.
export class CustomerOtpCodeHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): CustomerOtpCodeHash {
    if (hash.length === 0) {
      throw new TypeError('CustomerOtpCodeHash no puede estar vacio.');
    }
    return new CustomerOtpCodeHash(hash);
  }

  equals(other: CustomerOtpCodeHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
