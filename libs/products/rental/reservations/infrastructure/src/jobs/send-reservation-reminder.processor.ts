import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';

import { asPrismaTransaction } from '@platform/persistence-kernel';
import {
  PushTokenInvalidError,
  SendNotificationHandler,
  SendPushNotificationHandler,
} from '@platform/notifications/application';
import { UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import {
  CUSTOMER_LOOKUP_PORT,
  type CustomerLookupPort,
  RegisterCustomerPushTokenHandler,
} from '@rental/customers/application';

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
    private readonly sendPushNotification: SendPushNotificationHandler,
    private readonly registerCustomerPushToken: RegisterCustomerPushTokenHandler,
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

    if (contact.pushDeviceToken) {
      await this.sendPushBestEffort(contact.pushDeviceToken, contact.name, reservationId, {
        companyId,
        customerId,
      });
    }
  }

  // Best-effort: nunca lanza, nunca afecta el resultado del job ni la idempotencia ya
  // registrada arriba (docs/persistence/10-DECISIONES.md #122). Push no crea ninguna fila de
  // Notification (el aggregate lo excluye desde su diseño original, #89/#95) - distingue
  // PushTokenInvalidError (Expo confirmo que el token quedo invalido para siempre, se limpia
  // via RegisterCustomerPushTokenHandler) de cualquier otro fallo (podria ser transitorio, solo
  // se loguea).
  private async sendPushBestEffort(
    deviceToken: string,
    customerName: string,
    reservationId: string,
    owner: { companyId: string; customerId: string },
  ): Promise<void> {
    try {
      await this.sendPushNotification.execute({
        deviceToken,
        title: 'Recordatorio de tu reserva',
        body: `Hola ${customerName}, tu reserva esta por comenzar.`,
        data: { reservationId },
      });
    } catch (error) {
      if (error instanceof PushTokenInvalidError) {
        this.logger.log(
          `Push del recordatorio de la reservation "${reservationId}" fallo con un token invalido, limpiando pushDeviceToken del customer "${owner.customerId}".`,
        );
        await this.registerCustomerPushToken.execute({
          customerId: owner.customerId,
          companyId: owner.companyId,
          deviceToken: null,
        });
        return;
      }
      this.logger.warn(
        `Push del recordatorio de la reservation "${reservationId}" fallo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
