import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { SecurityDeposit, SecurityDepositNotFoundError } from '@platform/payments/domain';

import { ReleaseSecurityDepositHandler } from './release-security-deposit.handler';
import type { PaymentGatewayPort } from '../../ports/payment-gateway.port';
import type { SecurityDepositRepository } from '../../ports/security-deposit.repository';

function heldDeposit(gatewayHoldReference?: string): SecurityDeposit {
  return SecurityDeposit.hold({
    companyId: 'company-1',
    reservationId: 'reservation-1',
    amount: Money.from(50000, 'MXN'),
    gatewayHoldReference,
  });
}

function buildHandler(deposit: SecurityDeposit, gateway: Partial<PaymentGatewayPort> = {}) {
  const securityDepositRepository: SecurityDepositRepository = {
    findById: jest.fn((id) =>
      Promise.resolve(id.toString() === deposit.id.toString() ? deposit : null),
    ),
    findByReservationId: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const paymentGateway = gateway as PaymentGatewayPort;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ReleaseSecurityDepositHandler(
    securityDepositRepository,
    paymentGateway,
    unitOfWork,
    eventPublisher,
  );

  return { handler };
}

describe('ReleaseSecurityDepositHandler', () => {
  it('libera el deposit sin tocar el gateway si no hay gatewayHoldReference', async () => {
    const deposit = heldDeposit();
    const refundSpy = jest.fn();
    const { handler } = buildHandler(deposit, { refund: refundSpy });

    await handler.execute({ companyId: 'company-1', securityDepositId: deposit.id.toString() });

    expect(refundSpy).not.toHaveBeenCalled();
    expect(deposit.status).toBe('ReleasedFully');
  });

  it('libera la preautorizacion contra el gateway si hay gatewayHoldReference', async () => {
    const deposit = heldDeposit('gw-hold-1');
    const refundSpy = jest.fn().mockResolvedValue({ gatewayReference: 'gw-hold-1' });
    const { handler } = buildHandler(deposit, { refund: refundSpy });

    await handler.execute({ companyId: 'company-1', securityDepositId: deposit.id.toString() });

    expect(refundSpy).toHaveBeenCalledWith({
      gatewayReference: 'gw-hold-1',
      amount: { minorUnits: 50000, currency: 'MXN' },
    });
    expect(deposit.status).toBe('ReleasedFully');
  });

  it('lanza SecurityDepositNotFoundError si no existe o pertenece a otra company', async () => {
    const deposit = heldDeposit();
    const { handler } = buildHandler(deposit);

    await expect(
      handler.execute({ companyId: 'other-company', securityDepositId: deposit.id.toString() }),
    ).rejects.toThrow(SecurityDepositNotFoundError);
  });
});
