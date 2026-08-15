import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  BillingContact,
  type CompanyId,
  CompanyNotFoundError,
  LegalName,
} from '@platform/companies/domain';

import { COMPANY_REPOSITORY, type CompanyRepository } from '../../ports/company.repository';
import type { UpdateCompanyDetailsCommand } from './update-company-details.command';

@Injectable()
export class UpdateCompanyDetailsHandler {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdateCompanyDetailsCommand): Promise<void> {
    const companyId: CompanyId = EntityId.from(command.companyId);
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new CompanyNotFoundError(command.companyId);
    }

    const needsNewBillingContact =
      command.billingContactEmail !== undefined || command.billingContactPhone !== undefined;

    company.updateDetails({
      legalName: command.legalName ? LegalName.from(command.legalName) : undefined,
      billingContact: needsNewBillingContact
        ? BillingContact.from({
            email: command.billingContactEmail ?? company.billingContact.toEmail().toString(),
            phone: command.billingContactPhone ?? company.billingContact.toPhone(),
          })
        : undefined,
    });

    // Sin evento propio - updateDetails() no esta en el catalogo de docs/model/
    // 06-DOMAIN_EVENTS.md SS4 (solo CompanyRegistered.v1/CompanySuspended.v1) y no emite
    // ninguno; se persiste igual dentro de UnitOfWork.run() por consistencia transaccional.
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
    });
  }
}
