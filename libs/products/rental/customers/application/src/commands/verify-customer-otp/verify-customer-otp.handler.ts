import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  CustomerDeviceContext,
  CustomerOtpCodeHash,
  CustomerRefreshTokenHash,
  CustomerSession,
  InvalidCustomerOtpCodeError,
  OtpChallengeNotFoundError,
} from '@rental/customers/domain';
import { TOKEN_SIGNER, type TokenSigner } from '@platform/identity/application';

import {
  CUSTOMER_OTP_CHALLENGE_REPOSITORY,
  type CustomerOtpChallengeRepository,
} from '../../ports/customer-otp-challenge.repository';
import {
  CUSTOMER_OTP_CODE_GENERATOR,
  type CustomerOtpCodeGenerator,
} from '../../ports/customer-otp-code-generator.port';
import {
  CUSTOMER_REFRESH_TOKEN_HASHER,
  type CustomerRefreshTokenHasher,
} from '../../ports/customer-refresh-token-hasher.port';
import {
  CUSTOMER_SESSION_REPOSITORY,
  type CustomerSessionRepository,
} from '../../ports/customer-session.repository';
import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type {
  VerifyCustomerOtpCommand,
  VerifyCustomerOtpResult,
} from './verify-customer-otp.command';

@Injectable()
export class VerifyCustomerOtpHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(CUSTOMER_OTP_CHALLENGE_REPOSITORY)
    private readonly otpChallengeRepository: CustomerOtpChallengeRepository,
    @Inject(CUSTOMER_OTP_CODE_GENERATOR)
    private readonly otpCodeGenerator: CustomerOtpCodeGenerator,
    @Inject(CUSTOMER_SESSION_REPOSITORY)
    private readonly customerSessionRepository: CustomerSessionRepository,
    @Inject(CUSTOMER_REFRESH_TOKEN_HASHER)
    private readonly refreshTokenHasher: CustomerRefreshTokenHasher,
    @Inject(TOKEN_SIGNER) private readonly tokenSigner: TokenSigner,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: VerifyCustomerOtpCommand): Promise<VerifyCustomerOtpResult> {
    // Mismo codigo de error que "no hay challenge vigente" (OtpChallengeNotFoundError) si el
    // telefono no pertenece a ningun Customer - anti-enumeracion, igual que
    // RequestCustomerOtpHandler.
    const customer = await this.customerRepository.findByCompanyIdAndPhone(
      command.companyId,
      command.phone,
    );
    if (!customer) {
      throw new OtpChallengeNotFoundError();
    }

    const challenge = await this.otpChallengeRepository.findLatestForCustomer(
      customer.id.toString(),
      command.companyId,
    );
    // status !== 'Pending' (ya Verified o ya Expired) es un no-op para attemptVerification()
    // - no sube version (nada que persistir) - cortar aca evita reintentar un challenge ya
    // resuelto (replay del mismo request) intentando un save() que fallaria con
    // ConcurrentModificationError (bug real, docs/persistence/10-DECISIONES.md #111 - mismo
    // shape exacto ya corregido en VerifyMfaLoginHandler).
    if (!challenge || challenge.status !== 'Pending') {
      throw new OtpChallengeNotFoundError();
    }

    const presentedHash = CustomerOtpCodeHash.fromHash(this.otpCodeGenerator.hash(command.code));
    const outcome = challenge.attemptVerification(presentedHash, new Date());

    if (outcome !== 'Verified') {
      await this.unitOfWork.run(async (tx) => {
        await this.otpChallengeRepository.save(challenge, tx);
      }, command.companyId);

      throw outcome === 'Expired'
        ? new OtpChallengeNotFoundError()
        : new InvalidCustomerOtpCodeError();
    }

    const { hash: refreshHash, plaintext: refreshPlaintext } = this.refreshTokenHasher.generate();
    const session = CustomerSession.issue({
      customerId: customer.id.toString(),
      companyId: customer.companyId,
      refreshTokenHash: CustomerRefreshTokenHash.fromHash(refreshHash),
      deviceContext: CustomerDeviceContext.from({
        userAgent: command.userAgent,
        ipAddress: command.ipAddress,
      }),
    });

    const accessToken = this.tokenSigner.signAccessToken({
      sub: customer.id.toString(),
      companyId: customer.companyId,
      roles: [],
      actorType: 'Customer',
    });

    // Un unico UnitOfWork.run atomico - el challenge queda Verified y la sesion nace juntos,
    // nunca uno sin el otro (a diferencia del branch de arriba, donde nunca hay sesion que
    // crear).
    await this.unitOfWork.run(async (tx) => {
      await this.otpChallengeRepository.save(challenge, tx);
      await this.customerSessionRepository.save(session, tx);
      for (const event of session.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'CustomerSession',
          aggregateId: session.id.toString(),
          companyId: session.companyId,
          payload: { ...event },
        });
      }
    }, command.companyId);

    return {
      accessToken,
      refreshToken: refreshPlaintext,
      customerSessionId: session.id.toString(),
    };
  }
}
