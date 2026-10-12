import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IntegrationProvidersModule } from '@platform/integration-providers/infrastructure';
import {
  ConfirmUploadHandler,
  DeleteFileHandler,
  FILE_REPOSITORY,
  GetSignedUrlHandler,
  RequestUploadUrlHandler,
  STORAGE_LIMITS,
  type StorageLimits,
} from '@platform/files/application';

import { PrismaFileRepository } from './persistence/prisma/prisma-file.repository';
import { FilesController } from './http/files.controller';

// Importa IntegrationProvidersModule (no solo el token) - mismo mecanismo que UsersModule
// importando CompaniesModule para resolver COMPANY_EXISTS_PORT
// (libs/platform/users/infrastructure/src/users.module.ts): STORAGE_PROVIDER_PORT solo
// existe en el arbol de DI si el modulo que lo bindea esta importado. No exporta nada
// cross-modulo - ningun consumidor sincrono existe todavia (Vehicles/Customers/Invoices
// reciben un fileId por HTTP, no por DI).
@Module({
  imports: [IntegrationProvidersModule],
  controllers: [FilesController],
  providers: [
    { provide: FILE_REPOSITORY, useClass: PrismaFileRepository },
    {
      provide: STORAGE_LIMITS,
      useFactory: (configService: ConfigService): StorageLimits => {
        const storage = configService.getOrThrow<{ maxUploadBytes: number }>('storage');
        return { maxUploadBytes: storage.maxUploadBytes };
      },
      inject: [ConfigService],
    },
    RequestUploadUrlHandler,
    ConfirmUploadHandler,
    DeleteFileHandler,
    GetSignedUrlHandler,
  ],
})
export class FilesModule {}
