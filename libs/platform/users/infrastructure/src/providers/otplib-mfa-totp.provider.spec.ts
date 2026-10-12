import { OTP } from 'otplib';

import { OtplibMfaTotpProvider } from './otplib-mfa-totp.provider';

describe('OtplibMfaTotpProvider', () => {
  const provider = new OtplibMfaTotpProvider();

  describe('generateSecret', () => {
    it('devuelve un secret y una otpauth:// URI con el issuer/label', () => {
      const { secret, otpauthUrl } = provider.generateSecret('owner@example.com');

      expect(secret.length).toBeGreaterThan(0);
      expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(otpauthUrl).toContain('Renta%20Platform');
      expect(otpauthUrl).toContain('owner%40example.com');
    });

    it('genera un secret distinto en cada llamada', () => {
      const first = provider.generateSecret('owner@example.com');
      const second = provider.generateSecret('owner@example.com');

      expect(first.secret).not.toEqual(second.secret);
    });
  });

  describe('verifyCode', () => {
    it('acepta un codigo real generado para el mismo secret', async () => {
      const { secret } = provider.generateSecret('owner@example.com');
      const otp = new OTP({ strategy: 'totp' });
      const code = await otp.generate({ secret });

      await expect(provider.verifyCode(secret, code)).resolves.toBe(true);
    });

    it('rechaza un codigo incorrecto', async () => {
      const { secret } = provider.generateSecret('owner@example.com');

      await expect(provider.verifyCode(secret, '000000')).resolves.toBe(false);
    });
  });
});
