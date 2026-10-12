import { Module } from '@nestjs/common';

import { BranchesModule } from '@platform/branches/infrastructure';
import { CalendarModule } from '@platform/calendar/infrastructure';
import {
  AddRateHandler,
  CompleteMaintenanceHandler,
  CreateVehicleCategoryHandler,
  EnableVehicleHandler,
  MarkVehicleOutOfServiceHandler,
  RegisterVehicleHandler,
  ReportDamageHandler,
  ScheduleMaintenanceHandler,
  StartMaintenanceHandler,
  UploadVehicleDocumentHandler,
  VEHICLE_CATEGORY_LOOKUP_PORT,
  VEHICLE_CATEGORY_REPOSITORY,
  VEHICLE_REPOSITORY,
  VEHICLE_STATUS_PORT,
  VerifyVehicleDocumentHandler,
} from '@rental/vehicles/application';

import { VehicleCategoriesController } from './http/vehicle-categories.controller';
import { VehiclesController } from './http/vehicles.controller';
import { PrismaVehicleCategoryLookupAdapter } from './persistence/prisma/prisma-vehicle-category-lookup.adapter';
import { PrismaVehicleCategoryRepository } from './persistence/prisma/prisma-vehicle-category.repository';
import { PrismaVehicleRepository } from './persistence/prisma/prisma-vehicle.repository';
import { PrismaVehicleStatusAdapter } from './persistence/prisma/prisma-vehicle-status.adapter';
import { GetVehicleCategoryHandler } from './queries/get-vehicle-category.handler';
import { GetVehicleHandler } from './queries/get-vehicle.handler';
import { ListVehicleCategoriesHandler } from './queries/list-vehicle-categories.handler';
import { ListVehiclesHandler } from './queries/list-vehicles.handler';

// BranchesModule importado - RegisterVehicleHandler consulta BRANCH_LOOKUP_PORT (primer
// consumidor real, docs/persistence/03-RELACIONES.md, ver plan de implementacion). Sin
// importar FilesModule - uploadVehicleDocument confia en el fileId recibido, mismo gap
// aceptado que Customers. Exporta VEHICLE_STATUS_PORT/VEHICLE_CATEGORY_LOOKUP_PORT -
// Reservation (Fase 1 item 4, todavia no construido) los consumira cross-modulo.
// CalendarModule importado (docs/persistence/10-DECISIONES.md #116) - ListVehiclesHandler
// consulta CALENDAR_PORT.findOccupiedResourceIds() para la busqueda por disponibilidad. Sin
// ciclo: CalendarModule es scope:platform, no importa nada de negocio.
@Module({
  imports: [BranchesModule, CalendarModule],
  controllers: [VehiclesController, VehicleCategoriesController],
  providers: [
    { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
    { provide: VEHICLE_CATEGORY_REPOSITORY, useClass: PrismaVehicleCategoryRepository },
    { provide: VEHICLE_STATUS_PORT, useClass: PrismaVehicleStatusAdapter },
    { provide: VEHICLE_CATEGORY_LOOKUP_PORT, useClass: PrismaVehicleCategoryLookupAdapter },
    RegisterVehicleHandler,
    UploadVehicleDocumentHandler,
    VerifyVehicleDocumentHandler,
    EnableVehicleHandler,
    ScheduleMaintenanceHandler,
    StartMaintenanceHandler,
    CompleteMaintenanceHandler,
    ReportDamageHandler,
    MarkVehicleOutOfServiceHandler,
    CreateVehicleCategoryHandler,
    AddRateHandler,
    GetVehicleHandler,
    ListVehiclesHandler,
    GetVehicleCategoryHandler,
    ListVehicleCategoriesHandler,
  ],
  exports: [VEHICLE_STATUS_PORT, VEHICLE_CATEGORY_LOOKUP_PORT],
})
export class VehiclesModule {}
