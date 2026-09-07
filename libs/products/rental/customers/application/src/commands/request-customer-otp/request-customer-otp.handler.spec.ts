import type { UnitOfWork } from '@platform/shared-kernel';
import { ContactInfo, Customer, CustomerName, TaxIdOrDocumentId } from '@rental/customers/domain';
import type { SendNotificationHandler } from '@platform/notifications/application';

import type { CustomerOtpChallengeRepository } from '../../ports/customer-otp-challenge.repository';
import type { CustomerOtpCodeGenerator } from '../../ports/customer-otp-code-generator.port';
import type { CustomerRepository } from '../../ports/customer.repository';
import { RequestCustomerOtpHandler } from './request-customer-otp.handler';
import type { RequestCustomerOtpCommand } from './request-customer-otp.command';

function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

function buildHandler(overrides?: { customer?: Customer | null; sendExecute?: jest.Mock }) {
  const customer = overrides && 'customer' in overrides ? overrides.customer : createCustomer();

  const customerRepository: CustomerRepository = {
    findById: jest.fn(),
    findByCompanyIdAndPhone: jest.fn().mockResolvedValue(customer),
    save: jest.fn(),
  };
  const otpChallengeRepository: CustomerOtpChallengeRepository = {
    findLatestForCustomer: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const otpCodeGenerator: CustomerOtpCodeGenerator = {
    generate: jest.fn().mockReturnValue({ code: '123456', hash: 'code-hash' }),
    hash: jest.fn(),
  };
  const sendNotification = {
    execute: overrides?.sendExecute ?? jest.fn().mockResolvedValue(undefined),
  } as unknown as SendNotificationHandler;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };

  const handler = new RequestCustomerOtpHandler(
    customerRepository,
    otpChallengeRepository,
    otpCodeGenerator,
    sendNotification,
    unitOfWork,
  );

  return { handler, customerRepository, otpChallengeRepository, sendNotification };
}

const baseCommand: RequestCustomerOtpCommand = { companyId: 'company-1', phone: '+525512345678' };

describe('RequestCustomerOtpHandler', () => {
  it('es un no-op silencioso si el telefono no pertenece a ningun Customer de la company (anti-enumeracion)', async () => {
    const { handler, otpChallengeRepository, sendNotification } = buildHandler({ customer: null });

    await expect(handler.execute(baseCommand)).resolves.toBeUndefined();

    expect(otpChallengeRepository.save).not.toHaveBeenCalled();
    expect(sendNotification.execute).not.toHaveBeenCalled();
  });

  it('en exito: crea el challenge, lo persiste y manda el codigo solo por WhatsApp (requireExactChannel)', async () => {
    const { handler, otpChallengeRepository, sendNotification } = buildHandler();

    await handler.execute(baseCommand);

    expect(otpChallengeRepository.save).toHaveBeenCalledTimes(1);
    expect(sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        kind: 'SecurityCode',
        recipient: { phone: '+525512345678' },
        templateParams: { code: '123456' },
        requireExactChannel: 'WhatsApp',
      }),
    );
  });

  it('propaga el error si el envio por WhatsApp falla (NotificationDeliveryFailedError, dejado pasar tal cual)', async () => {
    const sendExecute = jest.fn().mockRejectedValue(new Error('WhatsApp no disponible'));
    const { handler } = buildHandler({ sendExecute });

    await expect(handler.execute(baseCommand)).rejects.toThrow('WhatsApp no disponible');
  });
});
