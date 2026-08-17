import { Module } from '@nestjs/common';

import {
  SETTINGS_LOOKUP_PORT,
  SETTINGS_REPOSITORY,
  UpdateEnabledProductModulesHandler,
  UpdatePaymentMethodsEnabledHandler,
} from '@platform/settings/application';

import { PrismaSettingsLookupAdapter } from './persistence/prisma/prisma-settings-lookup.adapter';
import { PrismaSettingsRepository } from './persistence/prisma/prisma-settings.repository';
import { SettingsController } from './http/settings.controller';
import { GetCompanySettingsHandler } from './queries/get-company-settings.handler';

// SETTINGS_REPOSITORY se exporta - CompaniesModule lo consume cross-modulo para crear
// CompanySettings junto con cada Company nueva (docs/persistence/07-MIGRACIONES.md SS5.2).
// SETTINGS_LOOKUP_PORT se exporta - TenantModuleEnabledGuard (apps/api) lo consume.
@Module({
  controllers: [SettingsController],
  providers: [
    { provide: SETTINGS_REPOSITORY, useClass: PrismaSettingsRepository },
    { provide: SETTINGS_LOOKUP_PORT, useClass: PrismaSettingsLookupAdapter },
    UpdateEnabledProductModulesHandler,
    UpdatePaymentMethodsEnabledHandler,
    GetCompanySettingsHandler,
  ],
  exports: [SETTINGS_REPOSITORY, SETTINGS_LOOKUP_PORT],
})
export class SettingsModule {}
