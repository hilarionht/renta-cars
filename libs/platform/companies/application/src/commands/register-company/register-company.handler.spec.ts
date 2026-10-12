import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { Company } from '@platform/companies/domain';
import type { CreateDefaultSettingsHandler } from '@platform/settings/application';

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
  const createDefaultSettings = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as CreateDefaultSettingsHandler;

  const handler = new RegisterCompanyHandler(
    companyRepository,
    unitOfWork,
    eventPublisher,
    createDefaultSettings,
  );

  return {
    handler,
    companyRepository,
    unitOfWork,
    eventPublisher,
    createDefaultSettings,
    savedCompanies,
  };
}

describe('RegisterCompanyHandler', () => {
  it('crea la company, la persiste dentro de UnitOfWork.run(company.id) y publica CompanyRegistered.v1', async () => {
    const {
      handler,
      companyRepository,
      unitOfWork,
      eventPublisher,
      createDefaultSettings,
      savedCompanies,
    } = buildHandler();

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
    // CompanySettings se crea junto con Company, en la misma transaccion (docs/persistence/
    // 07-MIGRACIONES.md SS5.2) - RegisterCompanyHandler orquesta llamando a
    // CreateDefaultSettingsHandler con el mismo `tx`, nunca construyendo CompanySettings el
    // mismo (companies/application no puede importar settings/domain).
    expect(createDefaultSettings.execute).toHaveBeenCalledWith(
      { companyId: companyId.toString() },
      expect.anything(),
    );
  });
});
