import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerOtpChallenge,
  CustomerOtpCodeHash,
  InvalidCustomerOtpCodeError,
  OtpChallengeNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';
import type { TokenSigner } from '@platform/identity/application';

import type { CustomerOtpChallengeRepository } from '../../ports/customer-otp-challenge.repository';
import type { CustomerOtpCodeGenerator } from '../../ports/customer-otp-code-generator.port';
import type { CustomerRefreshTokenHasher } from '../../ports/customer-refresh-token-hasher.port';
import type { CustomerSessionRepository } from '../../ports/customer-session.repository';
import type { CustomerRepository } from '../../ports/customer.repository';
import { VerifyCustomerOtpHandler } from './verify-customer-otp.handler';
import type { VerifyCustomerOtpCommand } from './verify-customer-otp.command';

function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

function issueChallenge(
  customerId: string,
  overrides?: { expiresAt?: Date },
): CustomerOtpChallenge {
  return CustomerOtpChallenge.request({
    companyId: 'company-1',
    customerId,
    phone: '+525512345678',
    codeHash: CustomerOtpCodeHash.fromHash('stored-hash'),
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
    maxAttempts: 5,
  });
}

function buildHandler(overrides?: {
  customer?: Customer | null;
  challenge?: CustomerOtpChallenge | null;
  presentedHash?: string;
}) {
  const customer = overrides && 'customer' in overrides ? overrides.customer : createCustomer();
  const challenge =
    overrides && 'challenge' in overrides
      ? overrides.challenge
      : customer && issueChallenge(customer.id.toString());

  const customerRepository: CustomerRepository = {
    findById: jest.fn(),
    findByCompanyIdAndPhone: jest.fn().mockResolvedValue(customer),
    save: jest.fn(),
  };
  const otpChallengeRepository: CustomerOtpChallengeRepository = {
    findLatestForCustomer: jest.fn().mockResolvedValue(challenge),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const otpCodeGenerator: CustomerOtpCodeGenerator = {
    generate: jest.fn(),
    hash: jest.fn().mockReturnValue(overrides?.presentedHash ?? 'stored-hash'),
  };
  const customerSessionRepository: CustomerSessionRepository = {
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    findActiveForCustomer: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenHasher: CustomerRefreshTokenHasher = {
    generate: jest.fn().mockReturnValue({ plaintext: 'new-plain-token', hash: 'new-hash' }),
    hash: jest.fn(),
  };
  const tokenSigner: TokenSigner = {
    signAccessToken: jest.fn().mockReturnValue('signed-access-token'),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new VerifyCustomerOtpHandler(
    customerRepository,
    otpChallengeRepository,
    otpCodeGenerator,
    customerSessionRepository,
    refreshTokenHasher,
    tokenSigner,
    unitOfWork,
    eventPublisher,
  );

  return { handler, otpChallengeRepository, customerSessionRepository, eventPublisher, challenge };
}

const baseCommand: VerifyCustomerOtpCommand = {
  companyId: 'company-1',
  phone: '+525512345678',
  code: '123456',
};

describe('VerifyCustomerOtpHandler', () => {
  it('lanza OtpChallengeNotFoundError si el telefono no pertenece a ningun Customer (anti-enumeracion)', async () => {
    const { handler } = buildHandler({ customer: null, challenge: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(OtpChallengeNotFoundError);
  });

  it('lanza OtpChallengeNotFoundError si no hay ningun CustomerOtpChallenge para el customer', async () => {
    const { handler } = buildHandler({ challenge: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(OtpChallengeNotFoundError);
  });

  it('lanza OtpChallengeNotFoundError si el challenge ya expiro, persistiendo la transicion a Expired', async () => {
    const { handler, otpChallengeRepository } = buildHandler();
    // Fuerza expiracion por tiempo via un challenge propio con expiresAt en el pasado.
    const expired = issueChallenge('irrelevant', { expiresAt: new Date(Date.now() - 1) });
    (otpChallengeRepository.findLatestForCustomer as jest.Mock).mockResolvedValue(expired);

    await expect(handler.execute(baseCommand)).rejects.toThrow(OtpChallengeNotFoundError);

    expect(otpChallengeRepository.save).toHaveBeenCalledWith(expired, {});
    expect(expired.status).toBe('Expired');
  });

  it('reintentar un challenge ya Verified lanza OtpChallengeNotFoundError sin volver a persistir (encontrado via el bug analogo de MFA, docs/persistence/10-DECISIONES.md #111)', async () => {
    const alreadyVerified = issueChallenge('customer-1');
    alreadyVerified.attemptVerification(CustomerOtpCodeHash.fromHash('stored-hash'), new Date());
    const { handler, otpChallengeRepository } = buildHandler({ challenge: alreadyVerified });

    await expect(handler.execute(baseCommand)).rejects.toThrow(OtpChallengeNotFoundError);
    expect(otpChallengeRepository.save).not.toHaveBeenCalled();
  });

  it('lanza InvalidCustomerOtpCodeError si el codigo no coincide, sin emitir sesion', async () => {
    const { handler, customerSessionRepository } = buildHandler({ presentedHash: 'wrong-hash' });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidCustomerOtpCodeError);
    expect(customerSessionRepository.save).not.toHaveBeenCalled();
  });

  it('en exito: marca el challenge Verified, emite una CustomerSession nueva y firma un access_token con actorType Customer', async () => {
    const {
      handler,
      otpChallengeRepository,
      customerSessionRepository,
      eventPublisher,
      challenge,
    } = buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('new-plain-token');
    expect(challenge?.status).toBe('Verified');
    expect(otpChallengeRepository.save).toHaveBeenCalledWith(challenge, {});
    expect(customerSessionRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'CustomerSessionCreated.v1' }),
    );
  });
});
