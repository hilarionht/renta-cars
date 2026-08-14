import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';

import { asPrismaTransaction } from './prisma-unit-of-work';

// Escritura atomica del evento de dominio (docs/technical/04-PERSISTENCE.md SS4) - se llama
// SIEMPRE dentro del mismo `tx` que PrismaUnitOfWork.run() le pasa al Command Handler,
// nunca fuera. No incluye el OutboxRelayWorker (BullMQ) que releeria published_at IS NULL
// tras un crash - fuera de alcance de esta tanda (Audit todavia no existe para consumir los
// eventos), gap de durabilidad documentado en docs/persistence/10-DECISIONES.md.
export interface DomainEventEnvelope {
  eventType: string; // "UserCreated.v1"
  aggregateType: string;
  aggregateId: string;
  companyId: string | null;
  sourceSchema: string; // "identity" | "organization" | ... - docs/persistence/10-DECISIONES.md #2
  payload: Prisma.InputJsonValue;
  occurredAt: Date;
}

@Injectable()
export class OutboxWriter {
  async write(tx: UnitOfWorkTransaction, event: DomainEventEnvelope): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    await prisma.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        companyId: event.companyId,
        sourceSchema: event.sourceSchema,
        payload: event.payload,
        occurredAt: event.occurredAt,
      },
    });
  }
}
