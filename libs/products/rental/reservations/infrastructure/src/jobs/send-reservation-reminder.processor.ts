import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';

import { asPrismaTransaction } from '@platform/persistence-kernel';
import { SendNotificationHandler } from '@platform/notifications/application';
import { UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';

interface SendReminderJobData {
  reservationId: string;
  companyId: string;
  customerId: string;
}

// docs/persistence/10-DECISIONES.md #121. Idempotente ante redelivery *at-least-once* de
// BullMQ (03-BACKEND-ARCHITECTURE.md §11, requisito no negociable): el INSERT en
// reservation_reminder_dispatches va ANTES del envio, no despues - si ya existe (P2002,
// reservationId UNIQUE), el job ya se proceso en un intento anterior y se corta sin
// reenviar. Falla "silencioso" (nunca reenvia) en vez de "duplicado" ante una carrera rara -
// mismo criterio de "mejor sub-notificar una vez en mil que duplicar" ya implicito en el
// resto de este mecanismo.
@Injectable()
@Processor('reservations.send-reminder')
export class SendReservationReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(SendReservationReminderProcessor.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    private readonly sendNotification: SendNotificationHandler,
  ) {
    super();
  }

  async process(job: Job<SendReminderJobData>): Promise<void> {
    const { reservationId, companyId, customerId } = job.data;

    const isFirstDispatch = await this.recordDispatch(companyId, reservationId);
    if (!isFirstDispatch) {
      this.logger.log(
        `Recordatorio de la reservation "${reservationId}" ya estaba despachado, omitido (idempotencia).`,
      );
      return;
    }

    const contact = await this.customerLookupPort.getContactInfo(customerId, companyId);
    if (!contact) {
      this.logger.error(
        `No se encontro el customer "${customerId}" para el recordatorio de la reservation "${reservationId}".`,
      );
      return;
    }

    await this.sendNotification.execute({
      companyId,
      kind: 'Reminder',
      recipient: { email: contact.email, phone: contact.phone },
      templateId: 'reservation-reminder',
      templateParams: { customerName: contact.name, reservationId },
    });
  }

  // true = primer despacho real (procede a enviar). false = ya existia (P2002 sobre
  // reservationId UNIQUE) - no reenvia.
  private async recordDispatch(companyId: string, reservationId: string): Promise<boolean> {
    try {
      await this.unitOfWork.run(async (tx) => {
        await asPrismaTransaction(tx).reservationReminderDispatch.create({
          data: { id: randomUUID(), companyId, reservationId, dispatchedAt: new Date() },
        });
      }, companyId);
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
