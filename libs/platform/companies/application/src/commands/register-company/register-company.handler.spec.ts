import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { Company } from '@platform/companies/domain';

import { RegisterCompanyHandler } from './register-company.handler';
import type { CompanyRepository } from '../../ports/company.repository';

function buildHandler() {
  const savedCompanies: Company[] = [];
  const companyRepository: CompanyRepository = {
    findById: jest.fn(),
    save: jest.fn((company: Company) => {
      savedCompanies.push(company);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RegisterCompanyHandler(companyRepository, unitOfWork, eventPublisher);

  return { handler, companyRepository, unitOfWork, eventPublisher, savedCompanies };
}

describe('RegisterCompanyHandler', () => {
  it('crea la company, la persiste dentro de UnitOfWork.run(company.id) y publica CompanyRegistered.v1', async () => {
    const { handler, companyRepository, unitOfWork, eventPublisher, savedCompanies } =
      buildHandler();

    const companyId = await handler.execute({
      legalName: 'Renta Demo SA',
      taxId: 'TAX-001',
      billingContactEmail: 'billing@example.com',
    });

    expect(companyId.toString()).toBeDefined();
    expect(companyRepository.save).toHaveBeenCalledTimes(1);
    expect(savedCompanies).toHaveLength(1);
    expect(savedCompanies[0].legalName.toString()).toBe('Renta Demo SA');
    // El companyId explicito pasado a UnitOfWork.run() debe ser el id recien generado -
    // el mecanismo de bootstrap RLS (docs/persistence/10-DECISIONES.md) depende de esto.
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), companyId.toString());
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'CompanyRegistered.v1',
        companyId: companyId.toString(),
      }),
    );
  });
});
