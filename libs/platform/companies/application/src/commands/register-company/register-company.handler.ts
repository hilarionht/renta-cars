import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  BillingContact,
  Company,
  type CompanyId,
  LegalName,
  TaxId,
} from '@platform/companies/domain';

import { COMPANY_REPOSITORY, type CompanyRepository } from '../../ports/company.repository';
import type { RegisterCompanyCommand } from './register-company.command';

// @Public() en el controller (docs/08-API-CONTRACTS.md, ver plan) - autorregistro tipo SaaS,
// la unica forma real de que exista una primera Company. Sin CompanyExistsPort ni ningun
// otro puerto cross-modulo - Company es la raiz, no depende de nadie.
@Injectable()
export class RegisterCompanyHandler {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterCompanyCommand): Promise<CompanyId> {
    const company = Company.create({
      legalName: LegalName.from(command.legalName),
      taxId: TaxId.from(command.taxId),
      billingContact: BillingContact.from({
        email: command.billingContactEmail,
        phone: command.billingContactPhone,
      }),
    });

    // companyId explicito = el id recien generado (todavia no persistido) - el SET LOCAL
    // que UnitOfWork.run() fija con el queda igual al valor que se esta insertando, asi que
    // el WITH CHECK implicito de la politica RLS de companies (USING id = current_setting)
    // pasa naturalmente. Ver docs/persistence/10-DECISIONES.md.
    await this.unitOfWork.run(async (tx) => {
      await this.companyRepository.save(company, tx);
      for (const event of company.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Company',
          aggregateId: company.id.toString(),
          companyId: company.id.toString(),
          payload: { ...event },
        });
      }
    }, company.id.toString());

    return company.id;
  }
}
