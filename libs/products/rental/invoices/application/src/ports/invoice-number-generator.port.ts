import type { UnitOfWorkTransaction } from '@platform/shared-kernel';

// Correlativo atomico por Company (RN-23, sin huecos dentro de su serie) - recibe la misma
// UnitOfWorkTransaction que IssueInvoiceHandler abre para persistir el aggregate, de forma
// que incrementar el contador y crear la Invoice sean atomicos (mismo mecanismo que
// asPrismaTransaction ya usa PrismaPaymentRepository.save()).
export const INVOICE_NUMBER_GENERATOR_PORT = Symbol('InvoiceNumberGeneratorPort');

export interface InvoiceNumberGeneratorPort {
  nextNumber(companyId: string, tx: UnitOfWorkTransaction): Promise<string>;
}
