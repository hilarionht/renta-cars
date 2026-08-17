import { Module } from '@nestjs/common';

import {
  BlockCustomerHandler,
  CUSTOMER_LOOKUP_PORT,
  CUSTOMER_REPOSITORY,
  RegisterAdditionalDriverHandler,
  RegisterCustomerHandler,
  RevokeAdditionalDriverHandler,
  UnblockCustomerHandler,
  UpdateCustomerDetailsHandler,
  UploadIdentityDocumentHandler,
  ValidateAdditionalDriverLicenseHandler,
  VerifyIdentityDocumentHandler,
} from '@rental/customers/application';

import { PrismaCustomerLookupAdapter } from './persistence/prisma/prisma-customer-lookup.adapter';
import { PrismaCustomerRepository } from './persistence/prisma/prisma-customer.repository';
import { CustomersController } from './http/customers.controller';
import { GetCustomerHandler } from './queries/get-customer.handler';
import { ListCustomersHandler } from './queries/list-customers.handler';

// Sin importar FilesModule - uploadIdentityDocument confia en el fileId recibido, sin
// FILE_EXISTS_PORT (decision ya tomada al construir Files, ver files.module.ts). Exporta
// CUSTOMER_LOOKUP_PORT - Reservation (Fase 1, todavia no construido) lo consumira cross-modulo.
@Module({
  controllers: [CustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: CUSTOMER_LOOKUP_PORT, useClass: PrismaCustomerLookupAdapter },
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
  ],
  exports: [CUSTOMER_LOOKUP_PORT],
})
export class CustomersModule {}
