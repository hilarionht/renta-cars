import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { PasswordResetChallenge } from '@platform/users/domain';

export const PASSWORD_RESET_CHALLENGE_REPOSITORY = Symbol('PasswordResetChallengeRepository');

export interface PasswordResetChallengeRepository {
  // Bypasea tenant-scoping - companyId es desconocido hasta encontrar la fila, mismo patron
  // que SessionRepository.findByRefreshTokenHash.
  findByTokenHash(tokenHash: string): Promise<PasswordResetChallenge | null>;
  save(challenge: PasswordResetChallenge, tx: UnitOfWorkTransaction): Promise<void>;
}
