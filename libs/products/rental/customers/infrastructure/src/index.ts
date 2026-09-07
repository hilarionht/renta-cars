// Superficie publica de "rental-customers-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { CustomersModule } from './customers.module';
export { CUSTOMERS_DOMAIN_ERROR_ENTRIES } from './errors/customers-domain-error.registry';
