import { Module } from '@nestjs/common';

import { IntegrationProvidersModule } from '@platform/integration-providers/infrastructure';
import { IdentityModule } from '@platform/identity/infrastructure';
import { NotificationsModule } from '@platform/notifications/infrastructure';
import {
  BlockCustomerHandler,
  CUSTOMER_LOOKUP_PORT,
  CUSTOMER_OTP_CHALLENGE_REPOSITORY,
  CUSTOMER_OTP_CODE_GENERATOR,
  CUSTOMER_REFRESH_TOKEN_HASHER,
  CUSTOMER_REPOSITORY,
  CUSTOMER_SESSION_REPOSITORY,
  ExtractIdentityDocumentHandler,
  RefreshCustomerSessionHandler,
  RegisterAdditionalDriverHandler,
  RegisterCustomerHandler,
  RequestCustomerOtpHandler,
  RevokeAdditionalDriverHandler,
  RevokeCustomerSessionHandler,
  UnblockCustomerHandler,
  UpdateCustomerDetailsHandler,
  UploadIdentityDocumentHandler,
  ValidateAdditionalDriverLicenseHandler,
  VerifyCustomerOtpHandler,
  VerifyIdentityDocumentHandler,
} from '@rental/customers/application';

import { Sha256CustomerOtpCodeGenerator } from './providers/customer-otp-code-generator.provider';
import { Sha256CustomerRefreshTokenHasher } from './providers/customer-refresh-token-hasher.provider';
import { PrismaCustomerLookupAdapter } from './persistence/prisma/prisma-customer-lookup.adapter';
import { PrismaCustomerOtpChallengeRepository } from './persistence/prisma/prisma-customer-otp-challenge.repository';
import { PrismaCustomerRepository } from './persistence/prisma/prisma-customer.repository';
import { PrismaCustomerSessionRepository } from './persistence/prisma/prisma-customer-session.repository';
import { CustomerAuthController } from './http/customer-auth.controller';
import { CustomersController } from './http/customers.controller';
import { GetCustomerHandler } from './queries/get-customer.handler';
import { ListCustomersHandler } from './queries/list-customers.handler';

// Sin importar FilesModule - uploadIdentityDocument confia en el fileId recibido, sin
// FILE_EXISTS_PORT (decision ya tomada al construir Files, ver files.module.ts). Exporta
// CUSTOMER_LOOKUP_PORT - Reservation (Fase 1, todavia no construido) lo consumira cross-modulo.
// NotificationsModule importado para RequestCustomerOtpHandler (SendNotificationHandler,
// mismo patron ya usado por ReservationConfirmedNotificationListener). IntegrationProvidersModule
// importado para ExtractIdentityDocumentHandler (DOCUMENT_EXTRACTION_PORT, OCR) - mismo patron
// ya usado por PaymentsModule.
@Module({
  imports: [IdentityModule, NotificationsModule, IntegrationProvidersModule],
  controllers: [CustomersController, CustomerAuthController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: CUSTOMER_LOOKUP_PORT, useClass: PrismaCustomerLookupAdapter },
    { provide: CUSTOMER_SESSION_REPOSITORY, useClass: PrismaCustomerSessionRepository },
    { provide: CUSTOMER_REFRESH_TOKEN_HASHER, useClass: Sha256CustomerRefreshTokenHasher },
    { provide: CUSTOMER_OTP_CHALLENGE_REPOSITORY, useClass: PrismaCustomerOtpChallengeRepository },
    { provide: CUSTOMER_OTP_CODE_GENERATOR, useClass: Sha256CustomerOtpCodeGenerator },
    RegisterCustomerHandler,
    UpdateCustomerDetailsHandler,
    UploadIdentityDocumentHandler,
    ExtractIdentityDocumentHandler,
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
    RequestCustomerOtpHandler,
    VerifyCustomerOtpHandler,
  ],
  exports: [CUSTOMER_LOOKUP_PORT],
})
export class CustomersModule {}
