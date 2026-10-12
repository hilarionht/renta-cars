// Superficie publica de "platform-integration-providers-infrastructure".
// Exporta explicitamente cada simbolo - prohibido `export *`. Ver docs/technical/
// 09-CODING-STANDARDS.md SS2. Solo el modulo se exporta - los adaptadores concretos
// (S3StorageProviderAdapter, etc.) son detalle interno, nunca importados directamente por
// nadie fuera de esta libreria.
export { IntegrationProvidersModule } from './integration-providers.module';
