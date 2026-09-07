import { PasswordResetChallenge } from './password-reset-challenge';
import { PasswordResetTokenHash } from '../value-objects/password-reset-token-hash';

const now = new Date('2026-08-27T12:00:00.000Z');
const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);

function issueChallenge(overrides?: { expiresAt?: Date }): PasswordResetChallenge {
  return PasswordResetChallenge.request({
    companyId: 'company-1',
    userId: 'user-1',
    tokenHash: PasswordResetTokenHash.fromHash('stored-hash'),
    expiresAt: overrides?.expiresAt ?? inThirtyMinutes,
  });
}

describe('PasswordResetChallenge', () => {
  it('request() crea un challenge Pending', () => {
    const challenge = issueChallenge();

    expect(challenge.status).toBe('Pending');
    expect(challenge.isNew).toBe(true);
  });

  it('attemptConsume() antes de expiresAt marca Verified', () => {
    const challenge = issueChallenge();

    const outcome = challenge.attemptConsume(now);

    expect(outcome).toBe('Verified');
    expect(challenge.status).toBe('Verified');
  });

  it('attemptConsume() despues de expiresAt devuelve Expired y persiste la transicion', () => {
    const challenge = issueChallenge({ expiresAt: new Date(now.getTime() - 1) });

    const outcome = challenge.attemptConsume(now);

    expect(outcome).toBe('Expired');
    expect(challenge.status).toBe('Expired');
    expect(challenge.version).toBe(2);
  });

  it('attemptConsume() sobre un challenge ya Verified devuelve Expired SIN subir version (nada que persistir)', () => {
    const challenge = issueChallenge();
    challenge.attemptConsume(now);
    const versionAfterFirstConsume = challenge.version;

    const outcome = challenge.attemptConsume(now);

    expect(outcome).toBe('Expired');
    expect(challenge.version).toBe(versionAfterFirstConsume);
  });

  it('markPersisted() apaga isNew', () => {
    const challenge = issueChallenge();

    challenge.markPersisted();

    expect(challenge.isNew).toBe(false);
  });

  it('reconstitute() reconstruye un challenge existente sin marcarlo nuevo', () => {
    const issued = issueChallenge();
    const challenge = PasswordResetChallenge.reconstitute({
      id: issued.id,
      companyId: 'company-1',
      userId: 'user-1',
      tokenHash: PasswordResetTokenHash.fromHash('stored-hash'),
      status: 'Pending',
      expiresAt: inThirtyMinutes,
      createdAt: now,
      version: 1,
    });

    expect(challenge.isNew).toBe(false);
  });
});
