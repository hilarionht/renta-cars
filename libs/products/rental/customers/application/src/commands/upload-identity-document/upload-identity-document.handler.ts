import { Inject, Injectable } from '@nestjs/common';

import { EntityId, UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import {
  type CustomerId,
  CustomerNotFoundError,
  type DocumentType,
  type IdentityDocumentOwner,
} from '@rental/customers/domain';

import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type { UploadIdentityDocumentCommand } from './upload-identity-document.command';

// fileId se confia tal cual, sin verificar contra Files (sin FILE_EXISTS_PORT - decision ya
// tomada al construir Files: "ningun consumidor sincrono existe todavia", ver
// libs/platform/files/infrastructure/src/files.module.ts). documentType ya validado contra
// el catalogo cerrado en el DTO HTTP.
@Injectable()
export class UploadIdentityDocumentHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UploadIdentityDocumentCommand): Promise<string> {
    const customerId: CustomerId = EntityId.from(command.customerId);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || customer.companyId !== command.companyId) {
      throw new CustomerNotFoundError(command.customerId);
    }

    const owner: IdentityDocumentOwner = command.additionalDriverId
      ? { type: 'AdditionalDriver', id: command.additionalDriverId }
      : { type: 'Customer', id: command.customerId };

    const documentId = customer.uploadIdentityDocument({
      owner,
      documentType: command.documentType as DocumentType,
      fileId: command.fileId,
      expiryDate: command.expiryDate,
      extractedByOcr: command.extractedByOcr,
    });

    // Sin eventos que publicar - "Cargar" no esta en el catalogo (ver Customer.uploadIdentityDocument).
    await this.unitOfWork.run(async (tx) => {
      await this.customerRepository.save(customer, tx);
    });

    return documentId.toString();
  }
}
