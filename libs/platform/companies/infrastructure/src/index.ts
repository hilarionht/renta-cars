// Superficie publica de "platform-companies-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { CompaniesModule } from './companies.module';
export { COMPANIES_DOMAIN_ERROR_ENTRIES } from './errors/companies-domain-error.registry';
