import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { asPrismaTransaction } from '@platform/persistence-kernel';
import { UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #145 (decision del usuario): hasta 3 intentos en total.
export const REMINDER_MAX_ATTEMPTS = 3;
// Un intento en Sending mas viejo que esto se considera colgado (el proceso murio a mitad del
// envio) y se puede volver a reclamar. Valor tecnico: un envio real tarda segundos.
export const REMINDER_STALE_SENDING_MS = 10 * 60 * 1000;

// Estado del despacho del recordatorio de una reserva (#145, "al menos una vez"). Una fila por
// reserva (reservation_id UNIQUE) que cada intento reclama y despues marca Sent o Failed. Todas
// las fechas salen del reloj de la app, igual que las del escaneo. Cada operacion es una
// transaccion corta: el envio nunca corre dentro de una.
@Injectable()
export class ReminderDispatchStore {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  // Devuelve el numero de intento reclamado, o null si no corresponde intentar: otro worker lo
  // tiene, ya salio o se agotaron los intentos. INSERT ... ON CONFLICT DO NOTHING (un P2002
  // abortaria la transaccion) y, si ya existia, UPDATE condicional. En READ COMMITTED el
  // segundo INSERT espera al indice unico y el segundo UPDATE reevalua el WHERE sobre la fila
  // ya confirmada: dos workers nunca reclaman el mismo intento.
  async claim(companyId: string, reservationId: string, now: Date): Promise<number | null> {
    return this.unitOfWork.run(async (tx) => {
      const prisma = asPrismaTransaction(tx);
      const created = await prisma.reservationReminderDispatch.createMany({
        data: [
          {
            id: randomUUID(),
            companyId,
            reservationId,
            dispatchedAt: now,
            status: 'Sending',
            attempts: 1,
            lastAttemptAt: now,
          },
        ],
        skipDuplicates: true,
      });
      if (created.count === 1) {
        return 1;
      }

      const staleBefore = new Date(now.getTime() - REMINDER_STALE_SENDING_MS);
      const reclaimed = await prisma.reservationReminderDispatch.updateMany({
        where: {
          reservationId,
          attempts: { lt: REMINDER_MAX_ATTEMPTS },
          OR: [{ status: 'Failed' }, { status: 'Sending', lastAttemptAt: { lt: staleBefore } }],
        },
        data: { status: 'Sending', attempts: { increment: 1 }, lastAttemptAt: now },
      });
      if (reclaimed.count === 0) {
        return null;
      }
      const row = await prisma.reservationReminderDispatch.findUnique({
        where: { reservationId },
        select: { attempts: true },
      });
      return row?.attempts ?? null;
    }, companyId);
  }

  // Solo si el intento sigue siendo el nuestro: un worker lento cuyo intento vencio no pisa el
  // estado del intento siguiente.
  async markSent(companyId: string, reservationId: string, attempt: number): Promise<void> {
    await this.finish(companyId, reservationId, attempt, { status: 'Sent', lastError: null });
  }

  async markFailed(
    companyId: string,
    reservationId: string,
    attempt: number,
    error: string,
  ): Promise<void> {
    await this.finish(companyId, reservationId, attempt, { status: 'Failed', lastError: error });
  }

  private async finish(
    companyId: string,
    reservationId: string,
    attempt: number,
    data: { status: 'Sent' | 'Failed'; lastError: string | null },
  ): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      await asPrismaTransaction(tx).reservationReminderDispatch.updateMany({
        where: { reservationId, status: 'Sending', attempts: attempt },
        data,
      });
    }, companyId);
  }
}
