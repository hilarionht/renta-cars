import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';

import {
  RequestContext,
  RequirePermission,
  RequiresProductModule,
  WRITE_HEAVY_THROTTLE_PROFILE,
} from '@platform/persistence-kernel';
import {
  ApproveExtensionHandler,
  CancelReservationHandler,
  CheckInReservationHandler,
  CheckOutReservationHandler,
  ConfirmReservationHandler,
  CreateReservationHandler,
  MarkNoShowHandler,
  RequestExtensionHandler,
  RescheduleReservationHandler,
  SwapVehicleHandler,
  type ReservationSummary,
} from '@rental/reservations/application';

import { GetReservationHandler } from '../queries/get-reservation.handler';
import { ListReservationsHandler } from '../queries/list-reservations.handler';
import { ApproveExtensionRequestDto } from './dto/approve-extension-request.dto';
import { CancelReservationRequestDto } from './dto/cancel-reservation-request.dto';
import { CheckInReservationRequestDto } from './dto/check-in-reservation-request.dto';
import { CheckOutReservationRequestDto } from './dto/check-out-reservation-request.dto';
import { CreateReservationRequestDto } from './dto/create-reservation-request.dto';
import { ListReservationsRequestDto } from './dto/list-reservations-request.dto';
import { RequestExtensionRequestDto } from './dto/request-extension-request.dto';
import { RescheduleReservationRequestDto } from './dto/reschedule-reservation-request.dto';
import { SwapVehicleRequestDto } from './dto/swap-vehicle-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS4: "reservations" escopeado por la company del
// token (Company-level, no Branch - "un Customer alquila en cualquier Branch de su
// Company"). Operaciones expuestas como POST sobre sub-rutas de accion, mismo criterio ya
// establecido en VehiclesController (:id/enable, :id/report-damage, etc.), no PATCH.
@RequiresProductModule('Rental')
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationHandler,
    private readonly confirmReservation: ConfirmReservationHandler,
    private readonly cancelReservation: CancelReservationHandler,
    private readonly markNoShow: MarkNoShowHandler,
    private readonly checkOutReservation: CheckOutReservationHandler,
    private readonly checkInReservation: CheckInReservationHandler,
    private readonly rescheduleReservation: RescheduleReservationHandler,
    private readonly requestExtension: RequestExtensionHandler,
    private readonly approveExtension: ApproveExtensionHandler,
    private readonly swapVehicle: SwapVehicleHandler,
    private readonly getReservation: GetReservationHandler,
    private readonly listReservations: ListReservationsHandler,
    private readonly requestContext: RequestContext,
  ) {}

  // Perfil WRITE-HEAVY (docs/09-SEGURIDAD.md SS6): mitiga spam de negocio ademas de abuso
  // tecnico - crear una reserva bloquea inventario real, no es un endpoint de solo lectura.
  @Throttle({
    default: {
      limit: WRITE_HEAVY_THROTTLE_PROFILE.limit,
      ttl: seconds(WRITE_HEAVY_THROTTLE_PROFILE.ttlSeconds),
    },
  })
  @Post()
  @RequirePermission('reservations:create')
  async create(@Body() dto: CreateReservationRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.createReservation.execute({
      companyId,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      authorizedDriverIds: dto.authorizedDriverIds,
    });
    return { id: id.toString() };
  }

  // Paginacion por cursor (docs/08-API-CONTRACTS.md SS5, docs/persistence/10-DECISIONES.md
  // #112) - reservations es el caso paradigmatico de listado de alto volumen, nunca
  // page/total (esos solo para catalogos pequeños y estables, docs/contracts/
  // 01-REST-STANDARDS.md SS5).
  @Get()
  async list(
    @Query() dto: ListReservationsRequestDto,
  ): Promise<{ data: ReservationSummary[]; meta: { nextCursor: string | null; limit: number } }> {
    const { companyId } = this.requestContext.get();
    const result = await this.listReservations.execute({
      companyId,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      status: dto.status,
      cursor: dto.cursor,
      limit: dto.limit,
    });
    return { data: result.items, meta: { nextCursor: result.nextCursor, limit: result.limit } };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationSummary> {
    const { companyId } = this.requestContext.get();
    return this.getReservation.execute({ companyId, reservationId: id });
  }

  @Post(':id/confirm')
  @RequirePermission('reservations:confirm')
  async confirm(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.confirmReservation.execute({ companyId, reservationId: id });
  }

  @Post(':id/cancel')
  @RequirePermission('reservations:cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.cancelReservation.execute({
      companyId,
      reservationId: id,
      cancelledBy: dto.cancelledBy,
    });
  }

  @Post(':id/mark-no-show')
  @RequirePermission('reservations:mark-no-show')
  async markReservationNoShow(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.markNoShow.execute({ companyId, reservationId: id });
  }

  @Post(':id/check-out')
  @RequirePermission('reservations:check-out')
  async checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutReservationRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.checkOutReservation.execute({
      companyId,
      reservationId: id,
      odometer: dto.odometer,
      fuelLevelPercentage: dto.fuelLevelPercentage,
      photoFileIds: dto.photoFileIds,
      inspectedBy: dto.inspectedBy,
    });
  }

  @Post(':id/check-in')
  @RequirePermission('reservations:check-in')
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInReservationRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.checkInReservation.execute({
      companyId,
      reservationId: id,
      odometer: dto.odometer,
      fuelLevelPercentage: dto.fuelLevelPercentage,
      photoFileIds: dto.photoFileIds,
      inspectedBy: dto.inspectedBy,
      damages: dto.damages?.map((damage) => ({
        description: damage.description,
        severity: damage.severity as 'Minor' | 'Severe',
        imputableToCustomer: damage.imputableToCustomer,
        photoFileIds: damage.photoFileIds,
        penaltyAmountMinorUnits: damage.penaltyAmountMinorUnits,
      })),
    });
  }

  @Post(':id/reschedule')
  @RequirePermission('reservations:reschedule')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleReservationRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.rescheduleReservation.execute({
      companyId,
      reservationId: id,
      newStartDate: new Date(dto.newStartDate),
      newEndDate: new Date(dto.newEndDate),
    });
  }

  @Post(':id/request-extension')
  @RequirePermission('reservations:request-extension')
  async requestReservationExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestExtensionRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.requestExtension.execute({
      companyId,
      reservationId: id,
      requestedNewEndDate: new Date(dto.requestedNewEndDate),
    });
  }

  @Post(':id/approve-extension')
  @RequirePermission('reservations:approve-extension')
  async approveReservationExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExtensionRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.approveExtension.execute({
      companyId,
      reservationId: id,
      newEndDate: new Date(dto.newEndDate),
    });
  }

  @Post(':id/swap-vehicle')
  @RequirePermission('reservations:swap-vehicle')
  async swap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SwapVehicleRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.swapVehicle.execute({
      companyId,
      reservationId: id,
      newVehicleId: dto.newVehicleId,
      reason: dto.reason,
    });
  }
}
