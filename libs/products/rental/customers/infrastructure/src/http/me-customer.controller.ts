import { Body, Controller, Patch } from '@nestjs/common';

import {
  RequestContext,
  RequireCustomerActor,
  RequiresProductModule,
} from '@platform/persistence-kernel';
import { RegisterCustomerPushTokenHandler } from '@rental/customers/application';

import { RegisterPushTokenRequestDto } from './dto/register-push-token-request.dto';

// Fase 5 cliente-autogestion, conectar Push a Reminder (docs/persistence/10-DECISIONES.md
// #122) - vive en customers (no en reservations, a diferencia de me-reservations.controller.ts)
// porque esto es 100% Customer propio, sin necesidad de cruzar a Reservation.
// @RequireCustomerActor() en toda la clase, mismo criterio que MeReservationsController -
// customerId/companyId SIEMPRE forzados desde RequestContext.get(), nunca del body.
@RequiresProductModule('Rental')
@RequireCustomerActor()
@Controller('me')
export class MeCustomerController {
  constructor(
    private readonly registerPushToken: RegisterCustomerPushTokenHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Patch('push-token')
  async registerDevicePushToken(@Body() dto: RegisterPushTokenRequestDto): Promise<void> {
    const { companyId, userId: customerId } = this.requestContext.get();
    await this.registerPushToken.execute({ companyId, customerId, deviceToken: dto.deviceToken });
  }
}
