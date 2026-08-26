import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';

import {
  AUTH_THROTTLE_PROFILE,
  RequestContext,
  RequireStaffActor,
} from '@platform/persistence-kernel';
import {
  ConfirmMfaEnrollmentHandler,
  DisableMfaHandler,
  MFA_TOTP_PORT,
  type MfaTotpPort,
} from '@platform/users/application';

import { GetMfaStatusHandler } from '../queries/get-mfa-status.handler';
import { ConfirmMfaEnrollmentRequestDto } from './dto/confirm-mfa-enrollment-request.dto';
import { DisableMfaRequestDto } from './dto/disable-mfa-request.dto';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - primer /me/* de "users" (mismo patron
// que me-reservations.controller.ts): actor SIEMPRE desde RequestContext.get().userId, NUNCA
// @RequirePermission() (self-service, no un recurso administrado por rol). @RequireStaffActor()
// a nivel de CLASE - sin este guard, un access_token de Customer (roles:[], misma forma de
// claims) llegaria a USER_REPOSITORY.findById(customerId) y fallaria confuso en vez de un 403
// limpio (ver staff-actor.guard.ts). Gap diferido explicito: sin recovery codes ni
// deshabilitado asistido por un admin - un usuario que pierde el dispositivo autenticador no
// tiene forma de desactivar MFA por esta via.
@RequireStaffActor()
@Controller('users/me/mfa')
export class UserMfaController {
  constructor(
    private readonly getMfaStatus: GetMfaStatusHandler,
    @Inject(MFA_TOTP_PORT) private readonly totp: MfaTotpPort,
    private readonly confirmEnrollment: ConfirmMfaEnrollmentHandler,
    private readonly disableMfa: DisableMfaHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async status(): Promise<{ enabled: boolean }> {
    const { userId, companyId } = this.requestContext.get();
    return this.getMfaStatus.execute({ userId, companyId });
  }

  // Stateless, sin persistencia (nada que hacer rollback) - MFA_TOTP_PORT.generateSecret()
  // directo. accountLabel = userId (opaco): esta ruta no tiene otro dato humano-legible a
  // mano sin agregar una dependencia nueva solo por cosmetica del QR.
  @Post('enroll')
  enroll(): { secret: string; otpauthUrl: string } {
    const { userId } = this.requestContext.get();
    return this.totp.generateSecret(userId);
  }

  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Post('enroll/confirm')
  async confirm(@Body() dto: ConfirmMfaEnrollmentRequestDto): Promise<void> {
    const { userId, companyId } = this.requestContext.get();
    await this.confirmEnrollment.execute({
      userId,
      companyId,
      secret: dto.secret,
      code: dto.code,
    });
  }

  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Post('disable')
  async disable(@Body() dto: DisableMfaRequestDto): Promise<void> {
    const { userId, companyId } = this.requestContext.get();
    await this.disableMfa.execute({ userId, companyId, code: dto.code });
  }
}
