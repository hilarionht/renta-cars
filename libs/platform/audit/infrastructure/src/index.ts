// Superficie publica de "platform-audit-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { AuditModule } from './audit.module';
export { AUDIT_DOMAIN_ERROR_ENTRIES } from './errors/audit-domain-error.registry';
