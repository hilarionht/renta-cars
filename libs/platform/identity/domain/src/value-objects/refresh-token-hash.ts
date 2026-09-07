// Hash del refresh token (nunca el token en claro persistido) - SHA-256, no argon2id
// (decision de esta tanda, ver plan): el refresh token ya es alta entropia (32+ bytes
// aleatorios), el modelo de amenaza es deteccion de reuso tras robo, no fuerza bruta
// offline - argon2id solo agregaria latencia en cada refresh sin beneficio real. El calculo
// real (crypto.createHash) vive en infrastructure/providers - domain/ no importa node:crypto.
export class RefreshTokenHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): RefreshTokenHash {
    if (hash.length === 0) {
      throw new TypeError('RefreshTokenHash no puede estar vacio.');
    }
    return new RefreshTokenHash(hash);
  }

  equals(other: RefreshTokenHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
