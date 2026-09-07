import { EntityId } from '@platform/shared-kernel';

import type { CustomerOtpCodeHash } from '../value-objects/customer-otp-code-hash';
import type { CustomerOtpChallengeStatus } from '../value-objects/customer-otp-challenge-status';

export type CustomerOtpChallengeId = EntityId<'CustomerOtpChallenge'>;
export type CustomerOtpVerificationOutcome = 'Verified' | 'InvalidCode' | 'Expired';

export interface CustomerOtpChallengeProps {
  id: CustomerOtpChallengeId;
  companyId: string;
  customerId: string;
  phone: string;
  codeHash: CustomerOtpCodeHash;
  status: CustomerOtpChallengeStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  createdAt: Date;
  version: number;
}

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - agregado corto y
// propio, no anidado en Customer (mismo motivo que Session/CustomerSession: tasa de
// escritura/lectura muy superior, y ademas efimero - irrelevante despues de su unico uso).
// Sin eventos de dominio: nada fuera de este modulo reacciona a la creacion/verificacion de
// un OTP (a diferencia de CustomerSession, cuyos eventos alimentan auditoria de seguridad).
export class CustomerOtpChallenge {
  private isNewAggregate = false;

  private constructor(private props: CustomerOtpChallengeProps) {}

  // El codigo/hash ya vienen calculados (infrastructure) - domain/ no genera bytes
  // aleatorios ni calcula hashes, solo modela el ciclo de vida.
  static request(params: {
    companyId: string;
    customerId: string;
    phone: string;
    codeHash: CustomerOtpCodeHash;
    expiresAt: Date;
    maxAttempts: number;
  }): CustomerOtpChallenge {
    const challenge = new CustomerOtpChallenge({
      id: EntityId.generate<'CustomerOtpChallenge'>(),
      companyId: params.companyId,
      customerId: params.customerId,
      phone: params.phone,
      codeHash: params.codeHash,
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

  static reconstitute(props: CustomerOtpChallengeProps): CustomerOtpChallenge {
    return new CustomerOtpChallenge(props);
  }

  get id(): CustomerOtpChallengeId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get phone(): string {
    return this.props.phone;
  }

  get codeHash(): CustomerOtpCodeHash {
    return this.props.codeHash;
  }

  get status(): CustomerOtpChallengeStatus {
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

  // Unico punto de mutacion tras request() - siempre persiste el resultado (attempts subio,
  // o el status cambio), sin excepcion: el caller (VerifyCustomerOtpHandler) decide que
  // error de dominio lanzar segun el outcome devuelto, mismo patron que
  // CustomerSessionSecurityService.rotate() (un metodo que informa, no que tira).
  attemptVerification(
    presentedCodeHash: CustomerOtpCodeHash,
    now: Date,
  ): CustomerOtpVerificationOutcome {
    if (this.props.status !== 'Pending' || now.getTime() >= this.props.expiresAt.getTime()) {
      if (this.props.status === 'Pending') {
        this.props.status = 'Expired';
        this.props.version += 1;
      }
      return 'Expired';
    }

    if (!this.props.codeHash.equals(presentedCodeHash)) {
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
