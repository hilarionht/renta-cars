import { Module } from '@nestjs/common';

import { IdentityModule } from '@platform/identity/infrastructure';
import {
  BlockCustomerHandler,
  CUSTOMER_LOOKUP_PORT,
  CUSTOMER_REFRESH_TOKEN_HASHER,
  CUSTOMER_REPOSITORY,
  CUSTOMER_SESSION_REPOSITORY,
  RefreshCustomerSessionHandler,
  RegisterAdditionalDriverHandler,
  RegisterCustomerHandler,
  RevokeAdditionalDriverHandler,
  RevokeCustomerSessionHandler,
  UnblockCustomerHandler,
  UpdateCustomerDetailsHandler,
  UploadIdentityDocumentHandler,
  ValidateAdditionalDriverLicenseHandler,
  VerifyIdentityDocumentHandler,
} from '@rental/customers/application';

import { Sha256CustomerRefreshTokenHasher } from './providers/customer-refresh-token-hasher.provider';
import { PrismaCustomerLookupAdapter } from './persistence/prisma/prisma-customer-lookup.adapter';
import { PrismaCustomerRepository } from './persistence/prisma/prisma-customer.repository';
import { PrismaCustomerSessionRepository } from './persistence/prisma/prisma-customer-session.repository';
import { CustomersController } from './http/customers.controller';
import { GetCustomerHandler } from './queries/get-customer.handler';
import { ListCustomersHandler } from './queries/list-customers.handler';

// Sin importar FilesModule - uploadIdentityDocument confia en el fileId recibido, sin
// FILE_EXISTS_PORT (decision ya tomada al construir Files, ver files.module.ts). Exporta
// CUSTOMER_LOOKUP_PORT - Reservation (Fase 1, todavia no construido) lo consumira cross-modulo.
@Module({
  imports: [IdentityModule],
  controllers: [CustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: CUSTOMER_LOOKUP_PORT, useClass: PrismaCustomerLookupAdapter },
    { provide: CUSTOMER_SESSION_REPOSITORY, useClass: PrismaCustomerSessionRepository },
    { provide: CUSTOMER_REFRESH_TOKEN_HASHER, useClass: Sha256CustomerRefreshTokenHasher },
    RegisterCustomerHandler,
    UpdateCustomerDetailsHandler,
    UploadIdentityDocumentHandler,
    VerifyIdentityDocumentHandler,
    RegisterAdditionalDriverHandler,
    ValidateAdditionalDriverLicenseHandler,
    RevokeAdditionalDriverHandler,
    BlockCustomerHandler,
    UnblockCustomerHandler,
    GetCustomerHandler,
    ListCustomersHandler,
    RefreshCustomerSessionHandler,
    RevokeCustomerSessionHandler,
  ],
  exports: [CUSTOMER_LOOKUP_PORT],
})
export class CustomersModule {}
