import { Module } from '@nestjs/common';

import { BranchesModule } from '@platform/branches/infrastructure';
import { CalendarModule } from '@platform/calendar/infrastructure';
import { NotificationsModule } from '@platform/notifications/infrastructure';
import { SettingsModule } from '@platform/settings/infrastructure';
import { CustomersModule } from '@rental/customers/infrastructure';
import {
  ApproveExtensionHandler,
  AvailabilityService,
  CancelReservationHandler,
  CheckInReservationHandler,
  CheckOutReservationHandler,
  CloseReservationHandler,
  ConfirmReservationHandler,
  CreateReservationHandler,
  MarkNoShowHandler,
  PricingService,
  RequestExtensionHandler,
  RESERVATION_REPOSITORY,
  RescheduleReservationHandler,
  SwapVehicleHandler,
} from '@rental/reservations/application';
import { VehiclesModule } from '@rental/vehicles/infrastructure';

import { InvoiceIssuedListener } from './events/invoice-issued.listener';
import { ReservationCancelledNotificationListener } from './events/reservation-cancelled-notification.listener';
import { ReservationConfirmedNotificationListener } from './events/reservation-confirmed-notification.listener';
import { MeReservationsController } from './http/me-reservations.controller';
import { ReservationsController } from './http/reservations.controller';
import { PrismaReservationRepository } from './persistence/prisma/prisma-reservation.repository';
import { GetReservationHandler } from './queries/get-reservation.handler';
import { ListReservationsHandler } from './queries/list-reservations.handler';

// Importa CustomersModule/VehiclesModule/CalendarModule/SettingsModule/BranchesModule -
// primer consumidor real de los 5 puertos forward-looking ya publicados
// (CUSTOMER_LOOKUP_PORT, VEHICLE_STATUS_PORT, VEHICLE_CATEGORY_LOOKUP_PORT, CALENDAR_PORT,
// BRANCH_LOOKUP_PORT) mas SETTINGS_LOOKUP_PORT extendido. Mismo patron que VehiclesModule
// importando BranchesModule - Nest reutiliza el mismo singleton aunque apps/api tambien
// importe estos modulos de forma independiente para sus propios controllers.
// CloseReservationHandler ya no esta atado a ningun endpoint HTTP (docs/persistence/
// 10-DECISIONES.md #79) - InvoiceIssuedListener (@OnEvent('InvoiceIssued.v1')) es su unico
// disparador real ahora que Invoices existe, mismo criterio que SecurityDepositHoldListener
// en Payments. NotificationsModule agregado en Fase 3 item 3 (docs/persistence/
// 10-DECISIONES.md #98) - ReservationConfirmedNotificationListener importa
// SendNotificationHandler directo (servicio de plataforma, no un modulo de negocio par;
// Notifications no puede alcanzar CustomerLookupPort por si sola, boundaries.mjs).
@Module({
  imports: [
    CustomersModule,
    VehiclesModule,
    CalendarModule,
    SettingsModule,
    BranchesModule,
    NotificationsModule,
  ],
  controllers: [ReservationsController, MeReservationsController],
  providers: [
    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    AvailabilityService,
    PricingService,
    CreateReservationHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
    MarkNoShowHandler,
    CheckOutReservationHandler,
    CheckInReservationHandler,
    RescheduleReservationHandler,
    RequestExtensionHandler,
    ApproveExtensionHandler,
    SwapVehicleHandler,
    CloseReservationHandler,
    GetReservationHandler,
    ListReservationsHandler,
    InvoiceIssuedListener,
    ReservationConfirmedNotificationListener,
    ReservationCancelledNotificationListener,
  ],
})
export class ReservationsModule {}
