import { Injectable } from '@nestjs/common';

import { asPrismaTransaction } from '@platform/persistence-kernel';
import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { InvoiceNumberGeneratorPort } from '@rental/invoices/application';

const NUMBER_PAD_LENGTH = 8;

// RN-23: correlativo sin huecos por Company. UPSERT atomico dentro de la MISMA transaccion
// que el insert de Invoice (recibe el mismo tx opaco que IssueInvoiceHandler abre) - crea la
// fila con next_number=1 en el primer uso, o la incrementa si ya existe, en una unica
// sentencia (sin race entre un SELECT y un UPDATE separados).
@Injectable()
export class PrismaInvoiceNumberGeneratorAdapter implements InvoiceNumberGeneratorPort {
  async nextNumber(companyId: string, tx: UnitOfWorkTransaction): Promise<string> {
    const prisma = asPrismaTransaction(tx);
    const rows = await prisma.$queryRaw<{ next_number: number }[]>`
      INSERT INTO rental.invoice_number_sequences (company_id, next_number)
      VALUES (${companyId}::uuid, 1)
      ON CONFLICT (company_id) DO UPDATE
        SET next_number = rental.invoice_number_sequences.next_number + 1
      RETURNING next_number
    `;
    const nextNumber = rows[0].next_number;
    return `INV-${String(nextNumber).padStart(NUMBER_PAD_LENGTH, '0')}`;
  }
}
