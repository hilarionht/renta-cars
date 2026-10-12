import { MfaLoginChallenge } from './mfa-login-challenge';

const now = new Date('2026-08-26T12:00:00.000Z');
const inFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000);

function issueChallenge(overrides?: { maxAttempts?: number; expiresAt?: Date }): MfaLoginChallenge {
  return MfaLoginChallenge.request({
    companyId: 'company-1',
    userId: 'user-1',
    expiresAt: overrides?.expiresAt ?? inFiveMinutes,
    maxAttempts: overrides?.maxAttempts ?? 5,
  });
}

describe('MfaLoginChallenge', () => {
  it('request() crea un challenge Pending con attempts en 0', () => {
    const challenge = issueChallenge();

    expect(challenge.status).toBe('Pending');
    expect(challenge.attempts).toBe(0);
    expect(challenge.isNew).toBe(true);
  });

  it('attemptVerification(true) marca Verified', () => {
    const challenge = issueChallenge();

    const outcome = challenge.attemptVerification(true, now);

    expect(outcome).toBe('Verified');
    expect(challenge.status).toBe('Verified');
  });

  it('attemptVerification(false) suma un intento y devuelve InvalidCode, sin cambiar el status', () => {
    const challenge = issueChallenge();

    const outcome = challenge.attemptVerification(false, now);

    expect(outcome).toBe('InvalidCode');
    expect(challenge.status).toBe('Pending');
    expect(challenge.attempts).toBe(1);
  });

  it('attemptVerification() agota los intentos y transiciona a Expired en el ultimo intento fallido', () => {
    const challenge = issueChallenge({ maxAttempts: 2 });

    challenge.attemptVerification(false, now);
    const outcome = challenge.attemptVerification(false, now);

    expect(outcome).toBe('InvalidCode');
    expect(challenge.status).toBe('Expired');
    expect(challenge.attempts).toBe(2);
  });

  it('attemptVerification() despues de expiresAt devuelve Expired sin evaluar el codigo, aunque sea valido', () => {
    const challenge = issueChallenge({ expiresAt: new Date(now.getTime() - 1) });

    const outcome = challenge.attemptVerification(true, now);

    expect(outcome).toBe('Expired');
    expect(challenge.status).toBe('Expired');
  });

  it('attemptVerification() sobre un challenge ya Verified devuelve Expired (no se puede reutilizar)', () => {
    const challenge = issueChallenge();
    challenge.attemptVerification(true, now);

    const outcome = challenge.attemptVerification(true, now);

    expect(outcome).toBe('Expired');
  });

  it('markPersisted() apaga isNew', () => {
    const challenge = issueChallenge();

    challenge.markPersisted();

    expect(challenge.isNew).toBe(false);
  });

  it('reconstitute() reconstruye un challenge existente sin marcarlo nuevo', () => {
    const issued = issueChallenge();
    const challenge = MfaLoginChallenge.reconstitute({
      id: issued.id,
      companyId: 'company-1',
      userId: 'user-1',
      status: 'Pending',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: inFiveMinutes,
      createdAt: now,
      version: 1,
    });

    expect(challenge.isNew).toBe(false);
  });
});
