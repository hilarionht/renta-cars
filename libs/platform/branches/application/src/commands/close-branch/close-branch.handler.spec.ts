import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  Address,
  Branch,
  BranchHasActiveReservationsError,
  BranchName,
  OperatingHours,
} from '@platform/branches/domain';

import type { BranchActiveReservationsPort } from '../../ports/branch-active-reservations.port';
import type { BranchRepository } from '../../ports/branch.repository';
import { CloseBranchHandler } from './close-branch.handler';

// docs/persistence/10-DECISIONES.md #140 (decision del usuario): no se cierra una sucursal con
// reservas confirmadas o en curso; sin implementacion del puerto (otro producto) se asume que
// no hay reservas.
function createBranch(): Branch {
  const branch = Branch.create({
    companyId: 'company-1',
    name: BranchName.from('Sucursal Centro'),
    address: Address.from({ line1: 'Av. Siempre Viva 123', city: 'CABA', country: 'AR' }),
    operatingHours: OperatingHours.from([{ day: 'monday', open: '09:00', close: '18:00' }]),
  });
  branch.pullDomainEvents();
  return branch;
}

function build(branch: Branch, reservationIds?: string[]) {
  const branchRepository: BranchRepository = {
    findById: jest.fn().mockResolvedValue(branch),
    findAllForCompany: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const tx = {};
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work(tx)) };
  const transactionLock = { acquire: jest.fn().mockResolvedValue(undefined) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const port: BranchActiveReservationsPort | undefined = reservationIds
    ? { findActiveReservationIds: jest.fn().mockResolvedValue(reservationIds) }
    : undefined;
  return {
    branchRepository,
    port,
    transactionLock,
    tx,
    handler: new CloseBranchHandler(
      branchRepository,
      unitOfWork,
      eventPublisher,
      transactionLock,
      port,
    ),
  };
}

describe('CloseBranchHandler (#140)', () => {
  it('con reservas activas responde BranchHasActiveReservationsError y no guarda', async () => {
    const branch = createBranch();
    const { handler, branchRepository } = build(branch, ['res-1', 'res-2']);

    await expect(
      handler.execute({ companyId: 'company-1', branchId: branch.id.toString() }),
    ).rejects.toThrow(BranchHasActiveReservationsError);
    expect(branchRepository.save).not.toHaveBeenCalled();
  });

  // #141: el chequeo corre con el lock exclusivo de la sucursal y dentro de la transaccion.
  it('toma el lock exclusivo de la sucursal y busca las reservas con el mismo tx', async () => {
    const branch = createBranch();
    const { handler, port, transactionLock, tx } = build(branch, []);

    await handler.execute({ companyId: 'company-1', branchId: branch.id.toString() });

    expect(transactionLock.acquire).toHaveBeenCalledWith(
      tx,
      `branch:${branch.id.toString()}`,
      'exclusive',
    );
    expect(port?.findActiveReservationIds).toHaveBeenCalledWith(
      'company-1',
      branch.id.toString(),
      tx,
    );
  });

  it('sin reservas activas cierra', async () => {
    const branch = createBranch();
    const { handler, branchRepository } = build(branch, []);

    await handler.execute({ companyId: 'company-1', branchId: branch.id.toString() });

    expect(branch.status).toBe('Closed');
    expect(branchRepository.save).toHaveBeenCalled();
  });

  it('sin implementacion del puerto (otro producto) cierra', async () => {
    const branch = createBranch();
    const { handler } = build(branch);

    await handler.execute({ companyId: 'company-1', branchId: branch.id.toString() });

    expect(branch.status).toBe('Closed');
  });

  it('cerrar una sucursal ya cerrada no guarda (no-op)', async () => {
    const branch = createBranch();
    branch.close();
    const { handler, branchRepository } = build(branch, ['res-1']);

    await handler.execute({ companyId: 'company-1', branchId: branch.id.toString() });

    expect(branchRepository.save).not.toHaveBeenCalled();
  });
});
