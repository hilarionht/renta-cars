import { Module } from '@nestjs/common';

import {
  AVAILABILITY_SLOT_REPOSITORY,
  CALENDAR_PORT,
  OccupySlotHandler,
  ReleaseSlotHandler,
} from '@platform/calendar/application';

import { AvailabilityController } from './http/availability.controller';
import { PrismaAvailabilitySlotRepository } from './persistence/prisma/prisma-availability-slot.repository';
import { PrismaCalendarPortAdapter } from './ports/prisma-calendar-port.adapter';
import { CheckAvailabilityHandler } from './queries/check-availability.handler';

// Sin imports de otros modulos de negocio - Calendar no consume nada (scope:platform,
// deliberadamente ciego a Vehicle/Reservation). Exporta CALENDAR_PORT - AvailabilityService
// (futuro modulo reservations, scope:product-rental) lo consumira cross-modulo.
@Module({
  controllers: [AvailabilityController],
  providers: [
    { provide: AVAILABILITY_SLOT_REPOSITORY, useClass: PrismaAvailabilitySlotRepository },
    { provide: CALENDAR_PORT, useClass: PrismaCalendarPortAdapter },
    OccupySlotHandler,
    ReleaseSlotHandler,
    CheckAvailabilityHandler,
  ],
  exports: [CALENDAR_PORT],
})
export class CalendarModule {}
