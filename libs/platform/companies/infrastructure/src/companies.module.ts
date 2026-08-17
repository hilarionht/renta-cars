import { Module } from '@nestjs/common';

import { COMPANY_EXISTS_PORT } from '@platform/shared-kernel';
import {
  COMPANY_LOOKUP_PORT,
  COMPANY_REPOSITORY,
  RegisterCompanyHandler,
  UpdateCompanyDetailsHandler,
} from '@platform/companies/application';
import { SettingsModule } from '@platform/settings/infrastructure';

import { PrismaCompanyExistsAdapter } from './persistence/prisma/prisma-company-exists.adapter';
import { PrismaCompanyLookupAdapter } from './persistence/prisma/prisma-company-lookup.adapter';
import { PrismaCompanyRepository } from './persistence/prisma/prisma-company.repository';
import { CompaniesController } from './http/companies.controller';
import { GetCompanyHandler } from './queries/get-company.handler';

// COMPANY_EXISTS_PORT (puerto de shared-kernel) se bindea aca, no en apps/api - a diferencia
// de cuando este modulo no existia (NoopCompanyExistsAdapter, ahora eliminado), la
// implementacion real SI pertenece a este modulo de negocio, no a la composicion de
// apps/api. Reemplaza el binding que prisma.module.ts tenia hacia el placeholder.
// Importa SettingsModule (no solo el token) - mismo mecanismo que UsersModule importando
// CompaniesModule: CreateDefaultSettingsHandler solo existe en el arbol de DI si el modulo
// que lo provee esta importado. RegisterCompanyHandler lo usa para crear CompanySettings
// junto con cada Company nueva (docs/persistence/07-MIGRACIONES.md SS5.2).
@Module({
  imports: [SettingsModule],
  controllers: [CompaniesController],
  providers: [
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
    { provide: COMPANY_EXISTS_PORT, useClass: PrismaCompanyExistsAdapter },
    { provide: COMPANY_LOOKUP_PORT, useClass: PrismaCompanyLookupAdapter },
    RegisterCompanyHandler,
    UpdateCompanyDetailsHandler,
    GetCompanyHandler,
  ],
  // COMPANY_EXISTS_PORT/COMPANY_LOOKUP_PORT se exportan - CreateUserHandler (platform-users)
  // y CompanyStatusGuard (apps/api) los consumen cross-modulo.
  exports: [COMPANY_EXISTS_PORT, COMPANY_LOOKUP_PORT],
})
export class CompaniesModule {}
