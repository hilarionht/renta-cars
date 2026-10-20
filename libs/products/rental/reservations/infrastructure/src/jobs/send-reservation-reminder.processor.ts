import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

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

import { ReminderDispatchStore } from '../persistence/prisma/reminder-dispatch.store';

interface SendReminderJobData {
  reservationId: string;
  companyId: string;
  customerId: string;
}

// docs/persistence/10-DECISIONES.md #121 y #145 ("al menos una vez"). Antes el despacho se
// registraba ANTES de enviar y un fallo no se reintentaba nunca. Ahora cada intento se reclama
// (ReminderDispatchStore.claim: dos workers nunca reclaman el mismo) y despues se marca Sent o
// Failed. El reintento lo maneja el escaneo (hasta 3 intentos, nunca despues del inicio de la
// reserva), no BullMQ: este processor nunca relanza. Tres transacciones cortas (reclamo, envio,
// resultado); el envio nunca corre dentro de una.
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
    private readonly dispatchStore: ReminderDispatchStore,
  ) {
    super();
  }

  async process(job: Job<SendReminderJobData>): Promise<void> {
    const { reservationId, companyId, customerId } = job.data;
    const now = new Date();

    // Antes de reclamar: si la reserva ya no aplica (cancelada o ya empezo), no se consume un
    // intento. El escaneo tampoco la vuelve a tomar.
    if (!(await this.isStillDue(companyId, reservationId, now))) {
      this.logger.log(
        `Recordatorio de la reservation "${reservationId}" omitido: ya no esta Confirmed o ya empezo.`,
      );
      return;
    }

    const attempt = await this.dispatchStore.claim(companyId, reservationId, now);
    if (attempt === null) {
      this.logger.log(
        `Recordatorio de la reservation "${reservationId}" omitido: ya salio, lo tiene otro intento o se agotaron los intentos.`,
      );
      return;
    }

    let contact: NonNullable<Awaited<ReturnType<CustomerLookupPort['getContactInfo']>>>;
    try {
      const found = await this.customerLookupPort.getContactInfo(customerId, companyId);
      if (!found) {
        throw new Error(`No se encontro el customer "${customerId}".`);
      }
      contact = found;
      await this.sendNotification.execute({
        companyId,
        kind: 'Reminder',
        recipient: { email: contact.email, phone: contact.phone },
        templateId: 'reservation-reminder',
        templateParams: { customerName: contact.name, reservationId },
        throwWhenUndelivered: true,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.dispatchStore.markFailed(companyId, reservationId, attempt, reason);
      this.logger.warn(
        `Recordatorio de la reservation "${reservationId}" fallo (intento ${attempt}): ${reason}`,
      );
      return;
    }
    await this.dispatchStore.markSent(companyId, reservationId, attempt);

    // Despues de marcar Sent y fuera del try: un error del push nunca vuelve el despacho a
    // Failed (eso causaria un reintento y un mensaje duplicado).
    if (contact.pushDeviceToken) {
      await this.sendPushBestEffort(contact.pushDeviceToken, contact.name, reservationId, {
        companyId,
        customerId,
      });
    }
  }

  private async isStillDue(companyId: string, reservationId: string, now: Date): Promise<boolean> {
    const reservation = await this.unitOfWork.run(
      (tx) =>
        asPrismaTransaction(tx).reservation.findFirst({
          where: {
            id: reservationId,
            companyId,
            status: 'Confirmed',
            startDate: { gt: now },
            deletedAt: null,
          },
          select: { id: true },
        }),
      companyId,
    );
    return reservation !== null;
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
        // #145: protegido, para que limpiar el token nunca haga fallar el job (el despacho ya
        // quedo Sent).
        await this.registerCustomerPushToken
          .execute({ customerId: owner.customerId, companyId: owner.companyId, deviceToken: null })
          .catch((cleanupError: unknown) =>
            this.logger.warn(
              `No se pudo limpiar el pushDeviceToken del customer "${owner.customerId}": ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
            ),
          );
        return;
      }
      this.logger.warn(
        `Push del recordatorio de la reservation "${reservationId}" fallo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
