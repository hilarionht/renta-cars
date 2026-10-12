import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { SecurityDeposit } from '@platform/payments/domain';

import { RetainSecurityDepositHandler } from './retain-security-deposit.handler';
import type { SecurityDepositRepository } from '../../ports/security-deposit.repository';

function heldDeposit(): SecurityDeposit {
  return SecurityDeposit.hold({
    companyId: 'company-1',
    reservationId: 'reservation-1',
    amount: Money.from(50000, 'MXN'),
  });
}

function buildHandler(deposit: SecurityDeposit) {
  const securityDepositRepository: SecurityDepositRepository = {
    findById: jest.fn((id) =>
      Promise.resolve(id.toString() === deposit.id.toString() ? deposit : null),
    ),
    findByReservationId: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RetainSecurityDepositHandler(
    securityDepositRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, eventPublisher };
}

describe('RetainSecurityDepositHandler', () => {
  it('retiene el monto parcial y publica SecurityDepositPartiallyRetained.v1', async () => {
    const deposit = heldDeposit();
    const { handler, eventPublisher } = buildHandler(deposit);

    await handler.execute({
      companyId: 'company-1',
      securityDepositId: deposit.id.toString(),
      retainedAmountMinorUnits: 20000,
      currency: 'MXN',
      reason: 'combustible faltante',
    });

    expect(deposit.status).toBe('RetainedPartially');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'SecurityDepositPartiallyRetained.v1' }),
    );
  });

  it('retiene el monto completo -> RetainedFully', async () => {
    const deposit = heldDeposit();
    const { handler } = buildHandler(deposit);

    await handler.execute({
      companyId: 'company-1',
      securityDepositId: deposit.id.toString(),
      retainedAmountMinorUnits: 50000,
      currency: 'MXN',
      reason: 'dano en la carroceria',
    });

    expect(deposit.status).toBe('RetainedFully');
  });
});
