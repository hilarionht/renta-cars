import { EntityId } from '@platform/shared-kernel';

import type { PasswordResetTokenHash } from '../value-objects/password-reset-token-hash';

export type PasswordResetChallengeId = EntityId<'PasswordResetChallenge'>;
export type PasswordResetOutcome = 'Verified' | 'Expired';

export interface PasswordResetChallengeProps {
  id: PasswordResetChallengeId;
  companyId: string;
  userId: string;
  tokenHash: PasswordResetTokenHash;
  status: 'Pending' | 'Verified' | 'Expired';
  expiresAt: Date;
  createdAt: Date;
  version: number;
}

// Recuperacion de contraseña (docs/persistence/10-DECISIONES.md #113) - agregado corto y
// propio, efimero, mismo motivo que CustomerOtpChallenge/MfaLoginChallenge. Mas simple que
// ambos: sin attempts/maxAttempts - a diferencia de un codigo de 6 digitos o un challenge
// buscado por una clave no secreta, este challenge se busca por el HASH del token
// presentado (32 bytes aleatorios, inadivinable) - no existe un "codigo incorrecto contra
// un challenge existente", findByTokenHash simplemente no encuentra nada.
// Sin eventos de dominio propios - PasswordResetTokenReplayed.v1 (auditoria de un token ya
// consumido/expirado reintentado) lo publica el HANDLER directamente, no esta entidad,
// mismo patron que LoginHandler.publishLoginFailed().
export class PasswordResetChallenge {
  private isNewAggregate = false;

  private constructor(private props: PasswordResetChallengeProps) {}

  static request(params: {
    companyId: string;
    userId: string;
    tokenHash: PasswordResetTokenHash;
    expiresAt: Date;
  }): PasswordResetChallenge {
    const challenge = new PasswordResetChallenge({
      id: EntityId.generate<'PasswordResetChallenge'>(),
      companyId: params.companyId,
      userId: params.userId,
      tokenHash: params.tokenHash,
      status: 'Pending',
      expiresAt: params.expiresAt,
      createdAt: new Date(),
      version: 1,
    });
    challenge.isNewAggregate = true;
    return challenge;
  }

  static reconstitute(props: PasswordResetChallengeProps): PasswordResetChallenge {
    return new PasswordResetChallenge(props);
  }

  get id(): PasswordResetChallengeId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): PasswordResetTokenHash {
    return this.props.tokenHash;
  }

  get status(): 'Pending' | 'Verified' | 'Expired' {
    return this.props.status;
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

  // IMPORTANTE (aprendido dos veces ya esta sesion: #111, y el fix de VerifyCustomerOtpHandler
  // en el mismo #111) - si se llama sobre un challenge que ya no esta Pending, NO sube
  // version (nada que persistir). El CALLER debe chequear `status === 'Pending'` ANTES de
  // llamar a este metodo y cortar sin save() si no lo esta - nunca guardar
  // incondicionalmente despues de llamarlo, o el intento de UPDATE con
  // `version: challenge.version - 1` no encuentra la fila real (ya en `version`) y tira
  // ConcurrentModificationError en vez de un error de dominio limpio.
  attemptConsume(now: Date): PasswordResetOutcome {
    if (this.props.status !== 'Pending' || now.getTime() >= this.props.expiresAt.getTime()) {
      if (this.props.status === 'Pending') {
        this.props.status = 'Expired';
        this.props.version += 1;
      }
      return 'Expired';
    }

    this.props.status = 'Verified';
    this.props.version += 1;
    return 'Verified';
  }
}
