import { EntityId } from '@platform/shared-kernel';

import type { MfaLoginChallengeStatus } from '../value-objects/mfa-login-challenge-status';

export type MfaLoginChallengeId = EntityId<'MfaLoginChallenge'>;
export type MfaLoginVerificationOutcome = 'Verified' | 'InvalidCode' | 'Expired';

export interface MfaLoginChallengeProps {
  id: MfaLoginChallengeId;
  companyId: string;
  userId: string;
  status: MfaLoginChallengeStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  createdAt: Date;
  version: number;
}

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - agregado corto y propio, no anidado
// en User (mismo motivo que Session/CustomerOtpChallenge: efimero, irrelevante despues de
// su unico uso). Sin codeHash propio, a diferencia de CustomerOtpChallenge: el secret TOTP
// vive en User (cifrado), no aca - attemptVerification() recibe el resultado de la
// comparacion YA CALCULADO (MFA_TOTP_PORT.verifyCode(), en application/), no compara nada
// internamente.
export class MfaLoginChallenge {
  private isNewAggregate = false;

  private constructor(private props: MfaLoginChallengeProps) {}

  static request(params: {
    companyId: string;
    userId: string;
    expiresAt: Date;
    maxAttempts: number;
  }): MfaLoginChallenge {
    const challenge = new MfaLoginChallenge({
      id: EntityId.generate<'MfaLoginChallenge'>(),
      companyId: params.companyId,
      userId: params.userId,
      status: 'Pending',
      attempts: 0,
      maxAttempts: params.maxAttempts,
      expiresAt: params.expiresAt,
      createdAt: new Date(),
      version: 1,
    });
    challenge.isNewAggregate = true;
    return challenge;
  }

  static reconstitute(props: MfaLoginChallengeProps): MfaLoginChallenge {
    return new MfaLoginChallenge(props);
  }

  get id(): MfaLoginChallengeId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): MfaLoginChallengeStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get maxAttempts(): number {
    return this.props.maxAttempts;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  // Mismo patron que CustomerOtpChallenge.attemptVerification(): siempre persiste el
  // resultado, nunca tira - el caller (VerifyMfaLoginHandler) decide que error de dominio
  // lanzar segun el outcome devuelto.
  attemptVerification(codeIsValid: boolean, now: Date): MfaLoginVerificationOutcome {
    if (this.props.status !== 'Pending' || now.getTime() >= this.props.expiresAt.getTime()) {
      if (this.props.status === 'Pending') {
        this.props.status = 'Expired';
        this.props.version += 1;
      }
      return 'Expired';
    }

    if (!codeIsValid) {
      this.props.attempts += 1;
      if (this.props.attempts >= this.props.maxAttempts) {
        this.props.status = 'Expired';
      }
      this.props.version += 1;
      return 'InvalidCode';
    }

    this.props.status = 'Verified';
    this.props.version += 1;
    return 'Verified';
  }
}
