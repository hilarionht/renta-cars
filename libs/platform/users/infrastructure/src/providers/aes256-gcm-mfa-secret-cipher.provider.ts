import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MfaSecretCipher } from '@platform/users/application';

// docs/persistence/10-DECISIONES.md #111. A diferencia de un gateway de pagos, una cipher
// sin clave real no tiene un "modo fake" razonable (texto plano persistido es una
// vulnerabilidad real, no una comodidad de desarrollo) - por eso este provider valida el
// formato de la clave en su propio constructor y falla ahi mismo (fail-fast en la practica:
// UsersModule siempre se compone en apps/api), en vez de depender de que env.validation.ts
// la exija globalmente (MFA es opt-in por User, no un toggle obligatorio al boot).
const IV_LENGTH_BYTES = 12;

@Injectable()
export class Aes256GcmMfaSecretCipher implements MfaSecretCipher {
  private readonly key: Buffer;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const hexKey = configService.get<string>('mfa.secretEncryptionKey', '');
    if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
      throw new Error(
        'MFA_SECRET_ENCRYPTION_KEY invalida o ausente - se espera hex de 32 bytes (64 caracteres). Generar con: openssl rand -hex 32.',
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !dataHex) {
      throw new Error('MfaSecretCipher: formato de ciphertext invalido.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
