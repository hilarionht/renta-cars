import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { SettingsLookupPort } from '@platform/settings/application';
import { InvalidPaymentMethodError, type Payment } from '@platform/payments/domain';

import { RequestPaymentHandler } from './request-payment.handler';
import type { PaymentRepository } from '../../ports/payment.repository';

function buildHandler(enabledMethods: string[] | null = null) {
  const savedPayments: Payment[] = [];
  const paymentRepository: PaymentRepository = {
    findById: jest.fn(),
    findByGatewayReference: jest.fn(),
    save: jest.fn((payment: Payment) => {
      savedPayments.push(payment);
      return Promise.resolve();
    }),
  };
  const settingsLookupPort = {
    getPaymentMethodsEnabled: jest.fn().mockResolvedValue(enabledMethods),
  } as unknown as SettingsLookupPort;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RequestPaymentHandler(
    paymentRepository,
    settingsLookupPort,
    unitOfWork,
    eventPublisher,
  );

  return { handler, paymentRepository, savedPayments };
}

describe('RequestPaymentHandler', () => {
  it('crea el payment Requested y lo persiste, sin publicar eventos', async () => {
    const { handler, paymentRepository, savedPayments } = buildHandler(['Cash']);

    const paymentId = await handler.execute({
      companyId: 'company-1',
      targetType: 'SecurityDeposit',
      targetId: 'deposit-1',
      amountMinorUnits: 50000,
      currency: 'MXN',
      method: 'Cash',
      idempotencyKey: 'idem-1',
    });

    expect(paymentId.toString()).toBeDefined();
    expect(paymentRepository.save).toHaveBeenCalledTimes(1);
    expect(savedPayments[0].status).toBe('Requested');
  });

  it('acepta cualquier metodo del catalogo si la Company no restringe (null)', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        companyId: 'company-1',
        targetType: 'Invoice',
        targetId: 'invoice-1',
        amountMinorUnits: 10000,
        currency: 'MXN',
        method: 'Card',
        idempotencyKey: 'idem-2',
      }),
    ).resolves.toBeDefined();
  });

  it('lanza InvalidPaymentMethodError si el metodo no esta en PaymentMethodsEnabled', async () => {
    const { handler } = buildHandler(['Cash']);

    await expect(
      handler.execute({
        companyId: 'company-1',
        targetType: 'Invoice',
        targetId: 'invoice-1',
        amountMinorUnits: 10000,
        currency: 'MXN',
        method: 'Card',
        idempotencyKey: 'idem-3',
      }),
    ).rejects.toThrow(InvalidPaymentMethodError);
  });

  it('lanza InvalidPaymentMethodError si el metodo esta fuera del catalogo cerrado', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        companyId: 'company-1',
        targetType: 'Invoice',
        targetId: 'invoice-1',
        amountMinorUnits: 10000,
        currency: 'MXN',
        method: 'Bitcoin',
        idempotencyKey: 'idem-4',
      }),
    ).rejects.toThrow(InvalidPaymentMethodError);
  });
});
