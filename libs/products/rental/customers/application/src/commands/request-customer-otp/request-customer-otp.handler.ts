import { Inject, Injectable } from '@nestjs/common';

import { UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { CustomerOtpChallenge, CustomerOtpCodeHash } from '@rental/customers/domain';
import { SendNotificationHandler } from '@platform/notifications/application';

import {
  CUSTOMER_OTP_CHALLENGE_REPOSITORY,
  type CustomerOtpChallengeRepository,
} from '../../ports/customer-otp-challenge.repository';
import {
  CUSTOMER_OTP_CODE_GENERATOR,
  type CustomerOtpCodeGenerator,
} from '../../ports/customer-otp-code-generator.port';
import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type { RequestCustomerOtpCommand } from './request-customer-otp.command';

// docs/persistence/10-DECISIONES.md #109 - ~5 min de vigencia, 5 intentos. Un codigo de 6
// digitos (10^6 combinaciones) se defiende con estos 2 numeros, no con el costo del hash
// (ver CustomerOtpCodeHash).
const OTP_EXPIRATION_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class RequestCustomerOtpHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(CUSTOMER_OTP_CHALLENGE_REPOSITORY)
    private readonly otpChallengeRepository: CustomerOtpChallengeRepository,
    @Inject(CUSTOMER_OTP_CODE_GENERATOR)
    private readonly otpCodeGenerator: CustomerOtpCodeGenerator,
    private readonly sendNotification: SendNotificationHandler,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  // Anti-enumeracion (mismo criterio que RevokeSessionHandler): un telefono que no
  // pertenece a ningun Customer de la company es un no-op silencioso, nunca un error - el
  // caller (customer-auth.controller, commit 3) siempre responde 204 sin impostar si el
  // telefono existe.
  async execute(command: RequestCustomerOtpCommand): Promise<void> {
    const customer = await this.customerRepository.findByCompanyIdAndPhone(
      command.companyId,
      command.phone,
    );
    if (!customer) {
      return;
    }

    const { code, hash } = this.otpCodeGenerator.generate();
    const challenge = CustomerOtpChallenge.request({
      companyId: command.companyId,
      customerId: customer.id.toString(),
      phone: command.phone,
      codeHash: CustomerOtpCodeHash.fromHash(hash),
      expiresAt: new Date(Date.now() + OTP_EXPIRATION_MS),
      maxAttempts: OTP_MAX_ATTEMPTS,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.otpChallengeRepository.save(challenge, tx);
    }, command.companyId);

    // requireExactChannel: 'WhatsApp' - sin fallback a Email/SMS (violaria el diseno "OTP sin
    // password, por WhatsApp"). Si falla, NotificationDeliveryFailedError propaga tal cual -
    // ya registrado en NOTIFICATIONS_DOMAIN_ERROR_ENTRIES (503), el challenge ya persistido
    // queda huerfano pero inofensivo (expira solo, nadie recibio el codigo para usarlo).
    await this.sendNotification.execute({
      companyId: command.companyId,
      kind: 'SecurityCode',
      recipient: { phone: command.phone },
      templateId: 'customer-otp-login',
      templateParams: { code },
      requireExactChannel: 'WhatsApp',
    });
  }
}
