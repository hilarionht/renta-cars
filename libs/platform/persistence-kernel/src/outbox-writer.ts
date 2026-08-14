import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  DomainEventPublisher,
  DomainEventToPublish,
  UnitOfWorkTransaction,
} from '@platform/shared-kernel';

import { asPrismaTransaction } from './prisma-unit-of-work';

// Implementacion del puerto DomainEventPublisher (docs/technical/04-PERSISTENCE.md SS4) -
// escritura atomica del evento de dominio, SIEMPRE dentro del mismo `tx` que
// PrismaUnitOfWork.run() le pasa al Command Handler, nunca fuera. No incluye el
// OutboxRelayWorker (BullMQ) ni emision EventEmitter2 en proceso - fuera de alcance de esta
// tanda (gap de durabilidad documentado en docs/persistence/10-DECISIONES.md).
//
// sourceSchema fijo en 'identity': esta libreria hoy solo la consumen los 3 modulos de
// Identity & Access, todos duenos del schema identity. Cuando otro modulo (organization,
// etc.) la reutilice, este campo pasa a ser parametro del constructor - no antes, para no
// generalizar sin un segundo caso de uso real todavia.
const SOURCE_SCHEMA = 'identity';

@Injectable()
export class OutboxWriter implements DomainEventPublisher {
  async publish(tx: UnitOfWorkTransaction, event: DomainEventToPublish): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    await prisma.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        companyId: event.companyId,
        sourceSchema: SOURCE_SCHEMA,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: new Date(),
      },
    });
  }
}
