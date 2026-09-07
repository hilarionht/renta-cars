import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { CustomerSummary, ListCustomersQuery } from '@rental/customers/application';

@Injectable()
export class ListCustomersHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListCustomersQuery): Promise<CustomerSummary[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.customer.findMany({ where: { companyId: query.companyId } }),
      query.companyId,
    );

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      taxIdOrDocumentId: record.taxIdOrDocumentId,
      customerType: record.customerType,
      status: record.status,
      blockStatus: record.blockStatus,
    }));
  }
}
