import { Module } from '@nestjs/common';

import { STORAGE_PROVIDER_PORT } from '@platform/files/application';

import { S3StorageProviderAdapter } from './providers/storage-s3/s3-storage-provider.adapter';

// Agrupa TODOS los adaptadores de proveedores externos (docs/ADR/0010-provider-pattern-
// integraciones.md) - hoy solo Storage, pero WhatsApp/Email/Stripe llegaran aca en sus
// propias subcarpetas providers/<name>/ sin tocar este modulo salvo para agregar su propio
// binding. Cada adaptador importa el puerto del modulo de negocio que lo definio
// (@platform/files/application hoy) - la direccion de dependencia es "el proveedor conoce
// al consumidor", inversa de la habitual "consumidor conoce al proveedor generico" -
// permitida por tooling/eslint/boundaries.mjs (type:infrastructure/type:application no
// estan restringidos por modulo en ninguna direccion).
@Module({
  providers: [{ provide: STORAGE_PROVIDER_PORT, useClass: S3StorageProviderAdapter }],
  exports: [STORAGE_PROVIDER_PORT],
})
export class IntegrationProvidersModule {}
