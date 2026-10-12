import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { Aes256GcmMfaSecretCipher } from './aes256-gcm-mfa-secret-cipher.provider';

function buildConfigService(value: string): ConfigService {
  return { get: jest.fn(() => value) } as unknown as ConfigService;
}

describe('Aes256GcmMfaSecretCipher', () => {
  const validKey = randomBytes(32).toString('hex');

  it('descifra lo que cifro, recuperando el texto plano original', () => {
    const cipher = new Aes256GcmMfaSecretCipher(buildConfigService(validKey));

    const ciphertext = cipher.encrypt('SECRETO-TOTP-BASE32');

    expect(ciphertext).not.toEqual('SECRETO-TOTP-BASE32');
    expect(cipher.decrypt(ciphertext)).toBe('SECRETO-TOTP-BASE32');
  });

  it('produce un ciphertext distinto en cada llamada (IV aleatorio)', () => {
    const cipher = new Aes256GcmMfaSecretCipher(buildConfigService(validKey));

    const first = cipher.encrypt('SECRETO-TOTP-BASE32');
    const second = cipher.encrypt('SECRETO-TOTP-BASE32');

    expect(first).not.toEqual(second);
  });

  it('tira si la clave esta ausente', () => {
    expect(() => new Aes256GcmMfaSecretCipher(buildConfigService(''))).toThrow(
      /MFA_SECRET_ENCRYPTION_KEY/,
    );
  });

  it('tira si la clave no tiene el formato hex de 32 bytes esperado', () => {
    expect(() => new Aes256GcmMfaSecretCipher(buildConfigService('no-es-hex'))).toThrow(
      /MFA_SECRET_ENCRYPTION_KEY/,
    );
  });
});
