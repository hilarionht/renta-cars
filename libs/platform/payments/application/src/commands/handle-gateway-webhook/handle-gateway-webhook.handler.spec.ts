import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Payment, PaymentMethod, PaymentNotFoundError } from '@platform/payments/domain';

import { HandleGatewayWebhookHandler } from './handle-gateway-webhook.handler';
import type { PaymentRepository } from '../../ports/payment.repository';

function authorizedPayment(): Payment {
  const payment = Payment.request({
    companyId: 'company-1',
    targetType: 'SecurityDeposit',
    targetId: 'deposit-1',
    amount: Money.from(50000, 'MXN'),
    method: PaymentMethod.from('Card'),
    idempotencyKey: 'idem-1',
  });
  payment.authorize('gw-ref-1');
  return payment;
}

function buildHandler(payment: Payment | null) {
  const paymentRepository: PaymentRepository = {
    findById: jest.fn(),
    findByGatewayReference: jest.fn().mockResolvedValue(payment),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new HandleGatewayWebhookHandler(paymentRepository, unitOfWork, eventPublisher);

  return { handler, paymentRepository, eventPublisher };
}

describe('HandleGatewayWebhookHandler', () => {
  it('captura el payment cuando la notificacion reporta "captured"', async () => {
    const payment = authorizedPayment();
    const { handler } = buildHandler(payment);

    await handler.execute({
      companyId: 'company-1',
      gatewayReference: 'gw-ref-1',
      result: 'captured',
    });

    expect(payment.status).toBe('Captured');
  });

  it('es idempotente: no-op si el payment ya esta en el estado destino', async () => {
    const payment = authorizedPayment();
    payment.capture('gw-ref-1');
    payment.pullDomainEvents();
    const { handler, paymentRepository } = buildHandler(payment);

    await handler.execute({
      companyId: 'company-1',
      gatewayReference: 'gw-ref-1',
      result: 'captured',
    });

    expect(paymentRepository.save).not.toHaveBeenCalled();
  });

  it('marca el payment como Failed cuando la notificacion reporta "failed"', async () => {
    const payment = authorizedPayment();
    const { handler } = buildHandler(payment);

    await handler.execute({
      companyId: 'company-1',
      gatewayReference: 'gw-ref-1',
      result: 'failed',
      reason: 'declinada',
    });

    expect(payment.status).toBe('Failed');
    expect(payment.failureReason).toBe('declinada');
  });

  it('lanza PaymentNotFoundError si no hay ningun payment con esa gatewayReference', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        companyId: 'company-1',
        gatewayReference: 'gw-ref-inexistente',
        result: 'captured',
      }),
    ).rejects.toThrow(PaymentNotFoundError);
  });
});
