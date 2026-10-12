// Superficie publica de "rental-invoices-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { INVOICE_REPOSITORY, type InvoiceRepository } from './ports/invoice.repository';
export {
  INVOICE_NUMBER_GENERATOR_PORT,
  type InvoiceNumberGeneratorPort,
} from './ports/invoice-number-generator.port';

export { IssueInvoiceHandler } from './commands/issue-invoice/issue-invoice.handler';
export type {
  IssueInvoiceCommand,
  IssueInvoiceChargeInput,
} from './commands/issue-invoice/issue-invoice.command';
export { VoidInvoiceHandler } from './commands/void-invoice/void-invoice.handler';
export type { VoidInvoiceCommand } from './commands/void-invoice/void-invoice.command';

export type {
  GetInvoiceQuery,
  InvoiceSummary,
  InvoiceChargeSummary,
} from './queries/get-invoice/get-invoice.query';
export type {
  ListInvoicesQuery,
  ListInvoicesResult,
} from './queries/list-invoices/list-invoices.query';
