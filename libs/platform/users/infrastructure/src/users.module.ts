import { Module } from '@nestjs/common';

import {
  AssignRoleHandler,
  ChangePasswordHandler,
  ConfirmMfaEnrollmentHandler,
  CreateUserHandler,
  DisableMfaHandler,
  DisableUserHandler,
  MFA_SECRET_CIPHER_PORT,
  MFA_TOTP_PORT,
  PASSWORD_HASHER,
  PASSWORD_RESET_CHALLENGE_REPOSITORY,
  PASSWORD_RESET_TOKEN_HASHER,
  ReactivateUserHandler,
  RequestPasswordResetHandler,
  ResetPasswordHandler,
  RevokeRoleHandler,
  USER_LOOKUP_PORT,
  USER_REPOSITORY,
} from '@platform/users/application';
import { RolesPermissionsModule } from '@platform/roles-permissions/infrastructure';
import { CompaniesModule } from '@platform/companies/infrastructure';
import { NotificationsModule } from '@platform/notifications/infrastructure';

import { Aes256GcmMfaSecretCipher } from './providers/aes256-gcm-mfa-secret-cipher.provider';
import { Argon2PasswordHasher } from './providers/argon2-password-hasher.provider';
import { OtplibMfaTotpProvider } from './providers/otplib-mfa-totp.provider';
import { Sha256PasswordResetTokenHasher } from './providers/sha256-password-reset-token-hasher.provider';
import { PrismaPasswordResetChallengeRepository } from './persistence/prisma/prisma-password-reset-challenge.repository';
import { PrismaUserLookupAdapter } from './persistence/prisma/prisma-user-lookup.adapter';
import { PrismaUserRepository } from './persistence/prisma/prisma-user.repository';
import { UserMfaController } from './http/user-mfa.controller';
import { UsersController } from './http/users.controller';
import { GetMfaStatusHandler } from './queries/get-mfa-status.handler';
import { GetUserHandler } from './queries/get-user.handler';

// Importa RolesPermissionsModule/CompaniesModule (no solo sus puertos) - necesita que
// ROLE_LOOKUP_PORT/COMPANY_EXISTS_PORT esten bindeados en el arbol de DI (ninguno de los dos
// modulos es @Global()). Companies ahora existe de verdad (antes de esta tanda,
// COMPANY_EXISTS_PORT se bindeaba global en apps/api via NoopCompanyExistsAdapter - ya
// eliminado, ver plan de implementacion) - el import invierte el orden literal del roadmap
// (Companies #3 antes que Users #5) pero coincide con la dependencia real de dominio (un
// User pertenece a una Company).
// NotificationsModule importado para RequestPasswordResetHandler (SendNotificationHandler,
// docs/persistence/10-DECISIONES.md #113) - mismo patron que customers.module.ts para
// RequestCustomerOtpHandler.
@Module({
  imports: [RolesPermissionsModule, CompaniesModule, NotificationsModule],
  controllers: [UsersController, UserMfaController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: USER_LOOKUP_PORT, useClass: PrismaUserLookupAdapter },
    { provide: MFA_TOTP_PORT, useClass: OtplibMfaTotpProvider },
    { provide: MFA_SECRET_CIPHER_PORT, useClass: Aes256GcmMfaSecretCipher },
    { provide: PASSWORD_RESET_TOKEN_HASHER, useClass: Sha256PasswordResetTokenHasher },
    {
      provide: PASSWORD_RESET_CHALLENGE_REPOSITORY,
      useClass: PrismaPasswordResetChallengeRepository,
    },
    CreateUserHandler,
    DisableUserHandler,
    ReactivateUserHandler,
    ChangePasswordHandler,
    AssignRoleHandler,
    RevokeRoleHandler,
    GetUserHandler,
    GetMfaStatusHandler,
    ConfirmMfaEnrollmentHandler,
    DisableMfaHandler,
    RequestPasswordResetHandler,
    ResetPasswordHandler,
  ],
  // PASSWORD_HASHER se exporta ademas de USER_LOOKUP_PORT - LoginHandler (platform-identity)
  // lo necesita para verificar la contraseña presentada contra el hash guardado, usando el
  // mismo hasher que CreateUser/ChangePassword (nunca dos implementaciones de argon2id).
  // MFA_TOTP_PORT/MFA_SECRET_CIPHER_PORT exportados para MFA TOTP (docs/persistence/
  // 10-DECISIONES.md #111) - VerifyMfaLoginHandler (platform-identity) los necesita para
  // descifrar el secret de un User y verificar el codigo presentado en el 2do factor.
  // RequestPasswordResetHandler/ResetPasswordHandler exportados para recuperacion de
  // contraseña (#113) - AuthController (platform-identity) los inyecta directo, mismas
  // rutas /auth/* que login/refresh/mfa-verify.
  exports: [
    USER_LOOKUP_PORT,
    PASSWORD_HASHER,
    MFA_TOTP_PORT,
    MFA_SECRET_CIPHER_PORT,
    RequestPasswordResetHandler,
    ResetPasswordHandler,
  ],
})
export class UsersModule {}
