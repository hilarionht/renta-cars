import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';

import type {
  DomainEventEmitted,
  DomainEventPublisher,
  DomainEventToPublish,
  UnitOfWorkTransaction,
} from '@platform/shared-kernel';

import { asPrismaTransaction } from './prisma-unit-of-work';

// Implementacion del puerto DomainEventPublisher (docs/technical/04-PERSISTENCE.md SS4) -
// escritura atomica del evento de dominio, SIEMPRE dentro del mismo `tx` que
// PrismaUnitOfWork.run() le pasa al Command Handler, nunca fuera. Ademas emite via
// EventEmitter2 (best-effort, in-process, fire-and-forget) justo despues del INSERT
// exitoso - Audit (platform-audit-infrastructure) escucha con un listener catch-all. Sin
// OutboxRelayWorker (BullMQ) todavia - gap de durabilidad documentado en
// docs/persistence/10-DECISIONES.md: un evento se pierde solo si el proceso muere entre el
// commit y este emit, nunca se pierde el dato de negocio ya persistido.
//
// sourceSchema se deriva de aggregateType (antes era una constante fija 'identity' - bug
// real: todo evento de Organization quedaba mal etiquetado, encontrado al construir Audit).
const AGGREGATE_TYPE_TO_SCHEMA: Record<string, string> = {
  User: 'identity',
  Role: 'identity',
  Session: 'identity',
  Company: 'organization',
  Branch: 'organization',
  CompanySettings: 'organization',
  File: 'support',
  // Agregado proactivamente esta vez, no descubierto por un smoke test fallando (mismo
  // mapa que ya causo bugs reales dos veces: #26/#35 en docs/persistence/10-DECISIONES.md).
  Customer: 'rental',
  Vehicle: 'rental',
  VehicleCategory: 'rental',
  AvailabilitySlot: 'scheduling',
};

function schemaFor(aggregateType: string): string {
  const schema = AGGREGATE_TYPE_TO_SCHEMA[aggregateType];
  if (!schema) {
    throw new Error(
      `OutboxWriter: aggregateType "${aggregateType}" no tiene schema mapeado en AGGREGATE_TYPE_TO_SCHEMA.`,
    );
  }
  return schema;
}

@Injectable()
export class OutboxWriter implements DomainEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(tx: UnitOfWorkTransaction, event: DomainEventToPublish): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const occurredAt = new Date();

    await prisma.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        companyId: event.companyId,
        sourceSchema: schemaFor(event.aggregateType),
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt,
      },
    });

    // Fire-and-forget: un fallo en un listener (p. ej. Audit) nunca debe hacer fallar la
    // operacion de negocio que origino el evento. `emit()` no devuelve una promesa que
    // esperar (a diferencia de `emitAsync()`, deliberadamente no usado aca).
    const emitted: DomainEventEmitted = { ...event, occurredAt };
    this.eventEmitter.emit(event.eventType, emitted);
  }
}
