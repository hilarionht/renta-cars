import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { PlatformAdminPrismaService, ReadTransaction } from '@platform/persistence-kernel';
import { RecordAuditLogEntryHandler } from '@platform/audit/application';

// docs/persistence/10-DECISIONES.md #121 - Reminder de reservas, primera cola de BullMQ de
// este repo. Repetible (registrada en onModuleInit) - intervalo placeholder sin calibrar
// (15min), mismo criterio que el resto de valores no calibrados de esta sesion.
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const SCAN_JOB_ID = 'reservation-reminder-scan';
const SEND_REMINDER_QUEUE = 'reservations.send-reminder';

interface SendReminderJobData {
  reservationId: string;
  companyId: string;
  customerId: string;
}

// Unico Processor de este repo que inyecta PlatformAdminPrismaService (BYPASSRLS,
// docs/persistence/06-RLS.md §5) - acotado EXCLUSIVAMENTE a enumerar company_id activas, una
// sola columna de una sola tabla (organization.companies). Todo lo demas (buscar Reservation
// por company) usa ReadTransaction normal (app_runtime, SET LOCAL) - mismo mecanismo que
// cualquier Query Handler, 06-RLS.md §6.
@Injectable()
@Processor('reservations.reminder-scan')
export class ReservationReminderScanProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReservationReminderScanProcessor.name);

  constructor(
    @InjectQueue('reservations.reminder-scan') private readonly scanQueue: Queue,
    @InjectQueue(SEND_REMINDER_QUEUE)
    private readonly sendReminderQueue: Queue<SendReminderJobData>,
    private readonly platformAdminPrisma: PlatformAdminPrismaService,
    private readonly readTransaction: ReadTransaction,
    @Inject(RecordAuditLogEntryHandler)
    private readonly recordAuditLogEntry: RecordAuditLogEntryHandler,
  ) {
    super();
  }

  // BullMQ 6.x mueve los jobs repetibles a la API de Job Scheduler (upsertJobScheduler) -
  // .add({repeat}) del estilo viejo ya no existe en JobsOptions. upsertJobScheduler es
  // idempotente por jobSchedulerId - re-registrar en cada boot de apps/api no crea
  // duplicados, solo actualiza la definicion si cambio.
  async onModuleInit(): Promise<void> {
    await this.scanQueue.upsertJobScheduler(
      SCAN_JOB_ID,
      { every: SCAN_INTERVAL_MS },
      { name: 'scan' },
    );
  }

  async process(): Promise<void> {
    const companies = await this.platformAdminPrisma.company.findMany({
      where: { status: 'Active' },
      select: { id: true },
    });

    // docs/persistence/06-RLS.md §5: "registrado con maxima prioridad en AuditLogEntry" -
    // companyId null porque la enumeracion en si abarca todas las companies, no una sola.
    await this.recordAuditLogEntry.execute({
      companyId: null,
      actorRef: 'system:reservation-reminder-scan',
      action: 'PlatformAdminBypassUsed',
      subjectType: 'Company',
      subjectId: 'all',
      payload: { companiesEnumerated: companies.length },
      occurredAt: new Date(),
    });

    for (const { id: companyId } of companies) {
      await this.scanCompany(companyId);
    }
  }

  private async scanCompany(companyId: string): Promise<void> {
    const dueReservations = await this.readTransaction.run(async (tx) => {
      const settings = await tx.companySettings.findFirst({
        where: { companyId },
        select: { reminderLeadTimeMinutes: true },
      });
      if (!settings) {
        return [];
      }

      const now = new Date();
      const windowEnd = new Date(now.getTime() + settings.reminderLeadTimeMinutes * 60_000);

      return tx.reservation.findMany({
        where: {
          companyId,
          status: 'Confirmed',
          startDate: { gte: now, lte: windowEnd },
          reminderDispatch: null,
        },
        select: { id: true, customerId: true },
      });
    }, companyId);

    for (const reservation of dueReservations) {
      await this.sendReminderQueue.add('send-reminder', {
        reservationId: reservation.id,
        companyId,
        customerId: reservation.customerId,
      });
    }

    if (dueReservations.length > 0) {
      this.logger.log(
        `Encolados ${dueReservations.length} recordatorio(s) de reserva para company "${companyId}".`,
      );
    }
  }
}
