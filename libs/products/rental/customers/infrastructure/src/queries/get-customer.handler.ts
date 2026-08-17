import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  CustomerDetail,
  GetCustomerQuery,
  IdentityDocumentSummary,
} from '@rental/customers/application';
import { CustomerNotFoundError } from '@rental/customers/domain';

@Injectable()
export class GetCustomerHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetCustomerQuery): Promise<CustomerDetail> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.customer.findFirst({
          where: { id: query.customerId },
          include: {
            identityDocuments: true,
            additionalDrivers: { include: { identityDocuments: true } },
          },
        }),
      query.companyId,
    );

    if (!record) {
      throw new CustomerNotFoundError(query.customerId);
    }

    const identityDocuments: IdentityDocumentSummary[] = record.identityDocuments.map(
      (document) => ({
        id: document.id,
        ownerType: 'Customer',
        ownerId: document.customerId as string,
        documentType: document.documentType,
        fileId: document.fileId,
        expiryDate: document.expiryDate.toISOString(),
        status: document.status,
      }),
    );

    const additionalDrivers = record.additionalDrivers.map((driver) => {
      for (const document of driver.identityDocuments) {
        identityDocuments.push({
          id: document.id,
          ownerType: 'AdditionalDriver',
          ownerId: document.additionalDriverId as string,
          documentType: document.documentType,
          fileId: document.fileId,
          expiryDate: document.expiryDate.toISOString(),
          status: document.status,
        });
      }
      return { id: driver.id, name: driver.name, status: driver.status };
    });

    return {
      id: record.id,
      companyId: record.companyId,
      name: record.name,
      taxIdOrDocumentId: record.taxIdOrDocumentId,
      contactEmail: record.contactEmail,
      contactPhone: record.contactPhone,
      customerType: record.customerType,
      status: record.status,
      blockStatus: record.blockStatus,
      blockReason: record.blockReason ?? undefined,
      identityDocuments,
      additionalDrivers,
    };
  }
}
