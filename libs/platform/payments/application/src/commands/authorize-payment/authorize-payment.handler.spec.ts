import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Payment, PaymentMethod, PaymentNotFoundError } from '@platform/payments/domain';

import { AuthorizePaymentHandler } from './authorize-payment.handler';
import { PaymentGatewayDeclinedError } from '../../errors/payment-gateway-declined.error';
import type { PaymentGatewayPort } from '../../ports/payment-gateway.port';
import type { PaymentRepository } from '../../ports/payment.repository';

function requestPayment(method = 'Card'): Payment {
  return Payment.request({
    companyId: 'company-1',
    targetType: 'SecurityDeposit',
    targetId: 'deposit-1',
    amount: Money.from(50000, 'MXN'),
    method: PaymentMethod.from(method),
    idempotencyKey: 'idem-1',
  });
}

function buildHandler(payment: Payment, gateway: Partial<PaymentGatewayPort>) {
  const paymentRepository: PaymentRepository = {
    findById: jest.fn((id) =>
      Promise.resolve(id.toString() === payment.id.toString() ? payment : null),
    ),
    findByGatewayReference: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const paymentGateway = gateway as PaymentGatewayPort;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new AuthorizePaymentHandler(
    paymentRepository,
    paymentGateway,
    unitOfWork,
    eventPublisher,
  );

  return { handler, paymentRepository };
}

describe('AuthorizePaymentHandler', () => {
  it('transiciona a Authorized cuando el gateway autoriza', async () => {
    const payment = requestPayment();
    const { handler, paymentRepository } = buildHandler(payment, {
      authorize: jest.fn().mockResolvedValue({ gatewayReference: 'gw-ref-1' }),
    });

    await handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() });

    expect(payment.status).toBe('Authorized');
    expect(payment.gatewayReference).toBe('gw-ref-1');
    expect(paymentRepository.save).toHaveBeenCalledTimes(1);
  });

  it('transiciona a Failed y relanza PaymentGatewayDeclinedError si el gateway rechaza', async () => {
    const payment = requestPayment();
    const { handler } = buildHandler(payment, {
      authorize: jest.fn().mockRejectedValue(new PaymentGatewayDeclinedError('tarjeta declinada')),
    });

    await expect(
      handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() }),
    ).rejects.toThrow(PaymentGatewayDeclinedError);
    expect(payment.status).toBe('Failed');
    expect(payment.failureReason).toBe('tarjeta declinada');
  });

  it('propaga cualquier otro error del gateway sin tocar el aggregate', async () => {
    const payment = requestPayment();
    const { handler } = buildHandler(payment, {
      authorize: jest.fn().mockRejectedValue(new Error('timeout')),
    });

    await expect(
      handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() }),
    ).rejects.toThrow('timeout');
    expect(payment.status).toBe('Requested');
  });

  it('lanza PaymentNotFoundError si el payment no existe o pertenece a otra company', async () => {
    const payment = requestPayment();
    const { handler } = buildHandler(payment, { authorize: jest.fn() });

    await expect(
      handler.execute({ companyId: 'other-company', paymentId: payment.id.toString() }),
    ).rejects.toThrow(PaymentNotFoundError);
  });
});
