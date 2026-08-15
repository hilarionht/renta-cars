// Superficie publica de "platform-branches-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { BranchesModule } from './branches.module';
export { BRANCHES_DOMAIN_ERROR_ENTRIES } from './errors/branches-domain-error.registry';
