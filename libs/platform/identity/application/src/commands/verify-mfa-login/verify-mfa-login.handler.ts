import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { InvalidMfaCodeError, MfaChallengeNotFoundError } from '@platform/identity/domain';
import {
  MFA_SECRET_CIPHER_PORT,
  MFA_TOTP_PORT,
  type MfaSecretCipher,
  type MfaTotpPort,
  USER_LOOKUP_PORT,
  type UserLookupPort,
} from '@platform/users/application';

import {
  MFA_LOGIN_CHALLENGE_REPOSITORY,
  type MfaLoginChallengeRepository,
} from '../../ports/mfa-login-challenge.repository';
import { SessionIssuer } from '../../services/session-issuer';
import type { VerifyMfaLoginCommand, VerifyMfaLoginResult } from './verify-mfa-login.command';

@Injectable()
export class VerifyMfaLoginHandler {
  constructor(
    @Inject(MFA_LOGIN_CHALLENGE_REPOSITORY)
    private readonly mfaLoginChallengeRepository: MfaLoginChallengeRepository,
    @Inject(USER_LOOKUP_PORT) private readonly userLookup: UserLookupPort,
    @Inject(MFA_SECRET_CIPHER_PORT) private readonly secretCipher: MfaSecretCipher,
    @Inject(MFA_TOTP_PORT) private readonly totp: MfaTotpPort,
    private readonly sessionIssuer: SessionIssuer,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: VerifyMfaLoginCommand): Promise<VerifyMfaLoginResult> {
    const challengeId = EntityId.from<'MfaLoginChallenge'>(command.mfaChallengeId);
    const challenge = await this.mfaLoginChallengeRepository.findById(
      challengeId,
      command.companyId,
    );
    // status !== 'Pending' (ya Verified o ya Expired) es un no-op para attemptVerification()
    // - no sube version (nada que persistir) - cortar aca evita reintentar un challenge ya
    // resuelto (replay del mismo request) y ademas ahorra decrypt+verifyCode inutiles.
    if (!challenge || challenge.status !== 'Pending') {
      throw new MfaChallengeNotFoundError();
    }

    const user = await this.userLookup.findById(challenge.userId, command.companyId);
    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new MfaChallengeNotFoundError();
    }

    const secret = this.secretCipher.decrypt(user.mfaSecretEncrypted);
    const codeIsValid = await this.totp.verifyCode(secret, command.code);
    const outcome = challenge.attemptVerification(codeIsValid, new Date());

    if (outcome !== 'Verified') {
      await this.unitOfWork.run(async (tx) => {
        await this.mfaLoginChallengeRepository.save(challenge, tx);
        if (outcome === 'InvalidCode') {
          await this.eventPublisher.publish(tx, {
            eventType: 'MfaVerificationFailed.v1',
            aggregateType: 'MfaLoginChallenge',
            aggregateId: challenge.id.toString(),
            companyId: challenge.companyId,
            payload: {
              mfaChallengeId: challenge.id.toString(),
              userId: challenge.userId,
              companyId: challenge.companyId,
            },
          });
        }
      }, command.companyId);

      throw outcome === 'Expired' ? new MfaChallengeNotFoundError() : new InvalidMfaCodeError();
    }

    await this.unitOfWork.run(async (tx) => {
      await this.mfaLoginChallengeRepository.save(challenge, tx);
    }, command.companyId);

    return this.sessionIssuer.issueForUser(user, {});
  }
}
