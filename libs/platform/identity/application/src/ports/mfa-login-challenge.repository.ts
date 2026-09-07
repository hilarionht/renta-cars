import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { MfaLoginChallenge, MfaLoginChallengeId } from '@platform/identity/domain';

export const MFA_LOGIN_CHALLENGE_REPOSITORY = Symbol('MfaLoginChallengeRepository');

export interface MfaLoginChallengeRepository {
  // Ruta @Public() (POST /auth/mfa/verify) - sin RequestContext poblado, companyId siempre
  // explicito, mismo patron que CustomerOtpChallengeRepository/UserLookupPort.findById().
  findById(id: MfaLoginChallengeId, companyId: string): Promise<MfaLoginChallenge | null>;
  save(challenge: MfaLoginChallenge, tx: UnitOfWorkTransaction): Promise<void>;
}
