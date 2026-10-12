// Superficie publica de "rental-vehicles-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { VehiclesModule } from './vehicles.module';
export { VEHICLES_DOMAIN_ERROR_ENTRIES } from './errors/vehicles-domain-error.registry';
