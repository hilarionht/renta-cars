// Superficie publica de "platform-files-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { FilesModule } from './files.module';
export { FILES_DOMAIN_ERROR_ENTRIES } from './errors/files-domain-error.registry';
