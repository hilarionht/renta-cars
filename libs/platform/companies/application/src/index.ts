// Superficie publica de "platform-companies-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { COMPANY_REPOSITORY, type CompanyRepository } from './ports/company.repository';
export { COMPANY_LOOKUP_PORT, type CompanyLookupPort } from './ports/company-lookup.port';
export { RegisterCompanyHandler } from './commands/register-company/register-company.handler';
export type { RegisterCompanyCommand } from './commands/register-company/register-company.command';
export { UpdateCompanyDetailsHandler } from './commands/update-company-details/update-company-details.handler';
export type { UpdateCompanyDetailsCommand } from './commands/update-company-details/update-company-details.command';
export type { GetCompanyQuery, CompanySummary } from './queries/get-company/get-company.query';
