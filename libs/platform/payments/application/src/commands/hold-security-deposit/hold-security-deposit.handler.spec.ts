import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { SecurityDeposit } from '@platform/payments/domain';

import { HoldSecurityDepositHandler } from './hold-security-deposit.handler';
import type { SecurityDepositRepository } from '../../ports/security-deposit.repository';

function buildHandler() {
  const savedDeposits: SecurityDeposit[] = [];
  const securityDepositRepository: SecurityDepositRepository = {
    findById: jest.fn(),
    findByReservationId: jest.fn(),
    save: jest.fn((deposit: SecurityDeposit) => {
      savedDeposits.push(deposit);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new HoldSecurityDepositHandler(
    securityDepositRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, securityDepositRepository, eventPublisher, savedDeposits };
}

describe('HoldSecurityDepositHandler', () => {
  it('crea el deposit Held, persiste y publica SecurityDepositHeld.v1', async () => {
    const { handler, securityDepositRepository, eventPublisher, savedDeposits } = buildHandler();

    const depositId = await handler.execute({
      companyId: 'company-1',
      reservationId: 'reservation-1',
      amountMinorUnits: 50000,
      currency: 'MXN',
    });

    expect(depositId.toString()).toBeDefined();
    expect(securityDepositRepository.save).toHaveBeenCalledTimes(1);
    expect(savedDeposits[0].status).toBe('Held');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'SecurityDepositHeld.v1',
        aggregateType: 'SecurityDeposit',
      }),
    );
  });
});
