import { Injectable } from '@nestjs/common';
import { OTP } from 'otplib';

import type { MfaTotpPort } from '@platform/users/application';

// docs/persistence/10-DECISIONES.md #111. issuer fijo (no viene de CompanySettings - un
// nombre de plataforma unico en el otpauth:// URI, la app autenticadora agrupa por
// issuer+label). epochTolerance: 30s (~1 time-step de 30s) tolera drift de reloj razonable
// entre el dispositivo del usuario y el servidor, sin ensanchar la ventana de aceptacion
// mas alla de lo que la mayoria de las apps autenticadoras ya toleran por si solas.
const ISSUER = 'Renta Platform';
const EPOCH_TOLERANCE_SECONDS = 30;

@Injectable()
export class OtplibMfaTotpProvider implements MfaTotpPort {
  private readonly otp = new OTP({ strategy: 'totp' });

  generateSecret(accountLabel: string): { secret: string; otpauthUrl: string } {
    const secret = this.otp.generateSecret();
    const otpauthUrl = this.otp.generateURI({ issuer: ISSUER, label: accountLabel, secret });
    return { secret, otpauthUrl };
  }

  async verifyCode(secret: string, code: string): Promise<boolean> {
    const result = await this.otp.verify({
      secret,
      token: code,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  }
}
