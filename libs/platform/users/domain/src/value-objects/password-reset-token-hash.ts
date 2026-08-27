// Hash del token de reset (nunca el token en claro persistido) - SHA-256, mismo criterio
// que RefreshTokenHash: el token ya es alta entropia (32 bytes aleatorios), el calculo real
// (crypto.createHash) vive en infrastructure/providers - domain/ no importa node:crypto.
export class PasswordResetTokenHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): PasswordResetTokenHash {
    if (hash.length === 0) {
      throw new TypeError('PasswordResetTokenHash no puede estar vacio.');
    }
    return new PasswordResetTokenHash(hash);
  }

  equals(other: PasswordResetTokenHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
