import { Controller, Get, Param, ParseUUIDPipe, Post, Body } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';

import {
  RequestContext,
  RequireCustomerActor,
  RequiresProductModule,
  WRITE_HEAVY_THROTTLE_PROFILE,
} from '@platform/persistence-kernel';
import {
  CancelReservationHandler,
  CreateReservationHandler,
  type ReservationSummary,
} from '@rental/reservations/application';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import { GetReservationHandler } from '../queries/get-reservation.handler';
import { ListReservationsHandler } from '../queries/list-reservations.handler';
import { CreateMyReservationRequestDto } from './dto/create-my-reservation-request.dto';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - vive en reservations
// (no en customers) porque reservations ya depende de customers, direccion ya establecida.
// @RequireCustomerActor() en TODA la clase, NUNCA @RequirePermission() - PermissionGuard
// resuelve roles[] -> permissions[] via ROLE_LOOKUP_PORT, y roles[] siempre viene vacio en
// un access_token de Customer (VerifyCustomerOtpHandler/RefreshCustomerSessionHandler,
// customers/application) - agregar @RequirePermission() aca cerraria en falso para
// cualquier cliente, nunca "por consistencia" con ReservationsController. customerId
// SIEMPRE forzado desde RequestContext.get().userId (poblado por TenantContextGuard desde
// el JWT ya validado), nunca desde body/query - CreateReservationHandler/
// ListReservationsHandler confian en el customerId recibido tal cual (seguro solo porque
// el caller lo fuerza aca). GetReservationHandler/CancelReservationHandler NO verifican
// ownership por si solos (confirmado al investigar el plan) - assertOwnership() lo hace
// explicito antes de cualquier lectura/escritura, mismo codigo (ReservationNotFoundError)
// que "no existe" para no filtrar la existencia de reservas de otros customers.
@RequiresProductModule('Rental')
@RequireCustomerActor()
@Controller('me/reservations')
export class MeReservationsController {
  constructor(
    private readonly createReservation: CreateReservationHandler,
    private readonly cancelReservation: CancelReservationHandler,
    private readonly getReservation: GetReservationHandler,
    private readonly listReservations: ListReservationsHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Throttle({
    default: {
      limit: WRITE_HEAVY_THROTTLE_PROFILE.limit,
      ttl: seconds(WRITE_HEAVY_THROTTLE_PROFILE.ttlSeconds),
    },
  })
  @Post()
  async create(@Body() dto: CreateMyReservationRequestDto): Promise<{ id: string }> {
    const { companyId, userId: customerId } = this.requestContext.get();
    const id = await this.createReservation.execute({
      companyId,
      customerId,
      vehicleId: dto.vehicleId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      authorizedDriverIds: dto.authorizedDriverIds,
    });
    return { id: id.toString() };
  }

  @Get()
  async list(): Promise<ReservationSummary[]> {
    const { companyId, userId: customerId } = this.requestContext.get();
    const result = await this.listReservations.execute({ companyId, customerId });
    return result.items;
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationSummary> {
    const { companyId, userId: customerId } = this.requestContext.get();
    const reservation = await this.getReservation.execute({ companyId, reservationId: id });
    this.assertOwnership(reservation, customerId, id);
    return reservation;
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId, userId: customerId } = this.requestContext.get();
    const reservation = await this.getReservation.execute({ companyId, reservationId: id });
    this.assertOwnership(reservation, customerId, id);
    await this.cancelReservation.execute({
      companyId,
      reservationId: id,
      cancelledBy: customerId,
    });
  }

  private assertOwnership(
    reservation: ReservationSummary,
    customerId: string,
    reservationId: string,
  ): void {
    if (reservation.customerId !== customerId) {
      throw new ReservationNotFoundError(reservationId);
    }
  }
}
