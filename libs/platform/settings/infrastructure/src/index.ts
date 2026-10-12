// Superficie publica de "platform-settings-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { SettingsModule } from './settings.module';
export { SETTINGS_DOMAIN_ERROR_ENTRIES } from './errors/settings-domain-error.registry';
