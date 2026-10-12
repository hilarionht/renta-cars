import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Payment, PaymentMethod } from '@platform/payments/domain';

import { RefundPaymentHandler } from './refund-payment.handler';
import type { PaymentGatewayPort } from '../../ports/payment-gateway.port';
import type { PaymentRepository } from '../../ports/payment.repository';

function capturedPayment(method: string, gatewayReference?: string): Payment {
  const payment = Payment.request({
    companyId: 'company-1',
    targetType: 'SecurityDeposit',
    targetId: 'deposit-1',
    amount: Money.from(50000, 'MXN'),
    method: PaymentMethod.from(method),
    idempotencyKey: 'idem-1',
  });
  payment.capture(gatewayReference);
  payment.pullDomainEvents();
  return payment;
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

  const handler = new RefundPaymentHandler(
    paymentRepository,
    paymentGateway,
    unitOfWork,
    eventPublisher,
  );

  return { handler };
}

describe('RefundPaymentHandler', () => {
  it('reembolsa contra el gateway para Card con gatewayReference', async () => {
    const payment = capturedPayment('Card', 'gw-ref-1');
    const refundSpy = jest.fn().mockResolvedValue({ gatewayReference: 'gw-ref-1' });
    const { handler } = buildHandler(payment, { refund: refundSpy });

    await handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() });

    expect(refundSpy).toHaveBeenCalledWith({
      gatewayReference: 'gw-ref-1',
      amount: { minorUnits: 50000, currency: 'MXN' },
    });
    expect(payment.status).toBe('Refunded');
  });

  it('reembolsa directo sin tocar el gateway para Cash', async () => {
    const payment = capturedPayment('Cash');
    const refundSpy = jest.fn();
    const { handler } = buildHandler(payment, { refund: refundSpy });

    await handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() });

    expect(refundSpy).not.toHaveBeenCalled();
    expect(payment.status).toBe('Refunded');
  });
});
