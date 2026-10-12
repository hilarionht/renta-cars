// Envuelve unicamente el secret TOTP ya cifrado - nunca el secret en claro, ni siquiera
// transitoriamente, mismo principio que PasswordHash. El cifrado/descifrado real (AES-256-
// GCM) vive en infrastructure/providers (MfaSecretCipher) - domain/ no importa node:crypto.
// La verificacion de un codigo TOTP tampoco vive aca - MfaTotpPort la resuelve desde
// application/, sobre el secret ya descifrado.
export class EncryptedMfaSecret {
  private constructor(private readonly value: string) {}

  static fromEncrypted(value: string): EncryptedMfaSecret {
    if (value.length === 0) {
      throw new TypeError('EncryptedMfaSecret no puede estar vacio.');
    }
    return new EncryptedMfaSecret(value);
  }

  toString(): string {
    return this.value;
  }
}
