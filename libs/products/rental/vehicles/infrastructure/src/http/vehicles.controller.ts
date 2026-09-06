import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import {
  RequestContext,
  RequirePermission,
  RequiresProductModule,
} from '@platform/persistence-kernel';
import {
  CompleteMaintenanceHandler,
  EnableVehicleHandler,
  MarkVehicleOutOfServiceHandler,
  RegisterVehicleHandler,
  ReportDamageHandler,
  ScheduleMaintenanceHandler,
  StartMaintenanceHandler,
  UploadVehicleDocumentHandler,
  VerifyVehicleDocumentHandler,
} from '@rental/vehicles/application';

import { GetVehicleHandler } from '../queries/get-vehicle.handler';
import { ListVehiclesHandler } from '../queries/list-vehicles.handler';
import { CompleteMaintenanceRequestDto } from './dto/complete-maintenance-request.dto';
import { ListVehiclesRequestDto } from './dto/list-vehicles-request.dto';
import { MarkVehicleOutOfServiceRequestDto } from './dto/mark-vehicle-out-of-service-request.dto';
import { RegisterVehicleRequestDto } from './dto/register-vehicle-request.dto';
import { ReportDamageRequestDto } from './dto/report-damage-request.dto';
import { ScheduleMaintenanceRequestDto } from './dto/schedule-maintenance-request.dto';
import { UploadVehicleDocumentRequestDto } from './dto/upload-vehicle-document-request.dto';
import type { VehicleResponseDto } from './dto/vehicle-response.dto';
import type { VehicleSummaryResponseDto } from './dto/vehicle-summary-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS4: "vehicles" siempre escopeado por la company del
// token. Segundo consumidor real de @RequiresProductModule() (el primero fue Customers).
@RequiresProductModule('Rental')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly registerVehicle: RegisterVehicleHandler,
    private readonly uploadVehicleDocument: UploadVehicleDocumentHandler,
    private readonly verifyVehicleDocument: VerifyVehicleDocumentHandler,
    private readonly enableVehicle: EnableVehicleHandler,
    private readonly scheduleMaintenance: ScheduleMaintenanceHandler,
    private readonly startMaintenance: StartMaintenanceHandler,
    private readonly completeMaintenance: CompleteMaintenanceHandler,
    private readonly reportDamage: ReportDamageHandler,
    private readonly markVehicleOutOfService: MarkVehicleOutOfServiceHandler,
    private readonly getVehicle: GetVehicleHandler,
    private readonly listVehicles: ListVehiclesHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  @RequirePermission('vehicles:manage')
  async create(@Body() dto: RegisterVehicleRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.registerVehicle.execute({
      companyId,
      branchId: dto.branchId,
      vehicleCategoryId: dto.vehicleCategoryId,
      licensePlate: dto.licensePlate,
      vin: dto.vin,
    });
    return { id: id.toString() };
  }

  // docs/persistence/10-DECISIONES.md #116: startDate/endDate opcionales - busqueda de
  // vehiculos disponibles para self-service de customers, mismo endpoint (ver #116 por que
  // se extiende GET /vehicles en vez de un recurso nuevo). #123: expand opcional, primera
  // implementacion real de docs/contracts/10-DECISIONES.md #3.
  @Get()
  async list(@Query() dto: ListVehiclesRequestDto): Promise<VehicleSummaryResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listVehicles.execute({
      companyId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      expand: dto.expand ? [dto.expand] : undefined,
    });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<VehicleResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getVehicle.execute({ vehicleId: id, companyId });
  }

  @Post(':id/documents')
  @RequirePermission('vehicles:manage')
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadVehicleDocumentRequestDto,
  ): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const documentId = await this.uploadVehicleDocument.execute({
      vehicleId: id,
      companyId,
      documentType: dto.documentType,
      fileId: dto.fileId,
      expiryDate: new Date(dto.expiryDate),
    });
    return { id: documentId };
  }

  @Post(':id/documents/:documentId/verify')
  @RequirePermission('vehicles:manage')
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.verifyVehicleDocument.execute({ vehicleId: id, companyId, documentId });
  }

  @Post(':id/enable')
  @RequirePermission('vehicles:manage')
  async enable(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.enableVehicle.execute({ vehicleId: id, companyId });
  }

  @Post(':id/maintenance')
  @RequirePermission('vehicles:manage')
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleMaintenanceRequestDto,
  ): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const maintenanceId = await this.scheduleMaintenance.execute({
      vehicleId: id,
      companyId,
      type: dto.type,
      scheduledStart: new Date(dto.scheduledStart),
      scheduledEnd: new Date(dto.scheduledEnd),
      responsibleUserId: dto.responsibleUserId,
    });
    return { id: maintenanceId };
  }

  @Post(':id/maintenance/:maintenanceId/start')
  @RequirePermission('vehicles:manage')
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('maintenanceId', ParseUUIDPipe) maintenanceId: string,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.startMaintenance.execute({ vehicleId: id, companyId, maintenanceId });
  }

  @Post(':id/maintenance/:maintenanceId/complete')
  @RequirePermission('vehicles:manage')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('maintenanceId', ParseUUIDPipe) maintenanceId: string,
    @Body() dto: CompleteMaintenanceRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.completeMaintenance.execute({
      vehicleId: id,
      companyId,
      maintenanceId,
      fitForService: dto.fitForService,
    });
  }

  @Post(':id/report-damage')
  @RequirePermission('vehicles:manage')
  async reportVehicleDamage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDamageRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.reportDamage.execute({
      vehicleId: id,
      companyId,
      severity: dto.severity,
      reason: dto.reason,
    });
  }

  @Post(':id/mark-out-of-service')
  @RequirePermission('vehicles:manage')
  async markOutOfService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkVehicleOutOfServiceRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.markVehicleOutOfService.execute({ vehicleId: id, companyId, reason: dto.reason });
  }
}
