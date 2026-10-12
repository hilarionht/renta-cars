import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { Branch } from '@platform/branches/domain';

import { CreateBranchHandler } from './create-branch.handler';
import type { CreateBranchCommand } from './create-branch.command';
import type { BranchRepository } from '../../ports/branch.repository';

function buildHandler() {
  const savedBranches: Branch[] = [];
  const branchRepository: BranchRepository = {
    findById: jest.fn(),
    findAllForCompany: jest.fn(),
    save: jest.fn((branch: Branch) => {
      savedBranches.push(branch);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new CreateBranchHandler(branchRepository, unitOfWork, eventPublisher);

  return { handler, branchRepository, unitOfWork, eventPublisher, savedBranches };
}

const baseCommand: CreateBranchCommand = {
  companyId: 'company-1',
  name: 'Sucursal Centro',
  address: { line1: 'Av. Siempre Viva 123', city: 'CABA', country: 'Argentina' },
  operatingHours: [{ day: 'monday', open: '09:00', close: '18:00' }],
};

describe('CreateBranchHandler', () => {
  it('crea la branch con el companyId del comando, la persiste dentro de UnitOfWork.run() ambiente y publica BranchOpened.v1', async () => {
    const { handler, branchRepository, unitOfWork, eventPublisher, savedBranches } = buildHandler();

    const branchId = await handler.execute(baseCommand);

    expect(branchId.toString()).toBeDefined();
    expect(branchRepository.save).toHaveBeenCalledTimes(1);
    expect(savedBranches).toHaveLength(1);
    expect(savedBranches[0].companyId).toBe('company-1');
    expect(savedBranches[0].name.toString()).toBe('Sucursal Centro');
    // Sin companyId explicito - a diferencia de RegisterCompany, CreateBranch corre siempre
    // en rutas autenticadas (RequestContext ambiente ya tiene el companyId correcto).
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function));
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'BranchOpened.v1', companyId: 'company-1' }),
    );
  });
});
