import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Payment, PaymentMethod } from '@platform/payments/domain';

import { CapturePaymentHandler } from './capture-payment.handler';
import { PaymentGatewayDeclinedError } from '../../errors/payment-gateway-declined.error';
import type { PaymentGatewayPort } from '../../ports/payment-gateway.port';
import type { PaymentRepository } from '../../ports/payment.repository';

function requestPayment(method: string): Payment {
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

  const handler = new CapturePaymentHandler(
    paymentRepository,
    paymentGateway,
    unitOfWork,
    eventPublisher,
  );

  return { handler, eventPublisher };
}

describe('CapturePaymentHandler', () => {
  it('captura directo sin tocar el gateway para Cash (RN-24)', async () => {
    const payment = requestPayment('Cash');
    const authorizeSpy = jest.fn();
    const { handler, eventPublisher } = buildHandler(payment, { capture: authorizeSpy });

    await handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() });

    expect(authorizeSpy).not.toHaveBeenCalled();
    expect(payment.status).toBe('Captured');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PaymentSucceeded.v1' }),
    );
  });

  it('captura contra el gateway para Card', async () => {
    const payment = requestPayment('Card');
    const { handler } = buildHandler(payment, {
      capture: jest.fn().mockResolvedValue({ gatewayReference: 'gw-ref-2' }),
    });

    await handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() });

    expect(payment.status).toBe('Captured');
    expect(payment.gatewayReference).toBe('gw-ref-2');
  });

  it('transiciona a Failed y relanza PaymentGatewayDeclinedError si el gateway rechaza la captura', async () => {
    const payment = requestPayment('Card');
    const { handler } = buildHandler(payment, {
      capture: jest.fn().mockRejectedValue(new PaymentGatewayDeclinedError('fondos insuficientes')),
    });

    await expect(
      handler.execute({ companyId: 'company-1', paymentId: payment.id.toString() }),
    ).rejects.toThrow(PaymentGatewayDeclinedError);
    expect(payment.status).toBe('Failed');
  });
});
