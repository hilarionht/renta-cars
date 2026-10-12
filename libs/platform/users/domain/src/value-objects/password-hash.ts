// Envuelve unicamente el hash ya calculado - nunca la contrasena en claro, ni siquiera
// transitoriamente (docs/model/04-VALUE_OBJECTS.md SS2). El hash real (argon2id) se calcula
// en infrastructure/providers (PasswordHasherPort) - domain/ no importa argon2, mismo
// principio que shared-kernel no importa @prisma/client. La verificacion (comparar un
// plaintext contra este hash) tambien pasa por PasswordHasherPort desde application/, nunca
// un metodo aca - un VO no inyecta dependencias.
export class PasswordHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): PasswordHash {
    if (hash.length === 0) {
      throw new TypeError('PasswordHash no puede estar vacio.');
    }
    return new PasswordHash(hash);
  }

  toString(): string {
    return this.value;
  }
}
