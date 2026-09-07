import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RequestContext } from '@platform/persistence-kernel';
import type { DomainEventEmitted } from '@platform/shared-kernel';
import { RecordAuditLogEntryHandler } from '@platform/audit/application';

// Listener catch-all (docs/technical/05-EVENTING.md SS5) - transcribe CUALQUIER evento de
// dominio a una fila de AuditLogEntry, sin excepcion, sin conocer el significado de negocio
// de cada uno. `'**'` (doble comodin, no `'*'`) porque EventEmitter2 en modo wildcard separa
// el nombre del evento por el delimitador por defecto ('.') - los eventType reales tienen
// forma "Nombre.v1" (dos segmentos), y un comodin de un solo nivel ('*') no los captura;
// verificado empiricamente, no solo asumido de la doc (que dice "*").
@Injectable()
export class DomainEventAuditListener {
  private readonly logger = new Logger(DomainEventAuditListener.name);

  constructor(
    private readonly recordAuditLogEntry: RecordAuditLogEntryHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @OnEvent('**')
  async handle(event: DomainEventEmitted): Promise<void> {
    try {
      const actorRef = this.requestContext.tryGet()?.userId ?? 'system';
      await this.recordAuditLogEntry.execute({
        companyId: event.companyId,
        actorRef,
        action: event.eventType,
        subjectType: event.aggregateType,
        subjectId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt,
      });
    } catch (error) {
      // Un fallo al auditar nunca debe propagarse - ya se emitio en fire-and-forget desde
      // OutboxWriter, no hay nada que revertir ni ningun caller esperando esta promesa.
      this.logger.error(
        `No se pudo registrar AuditLogEntry para el evento "${event.eventType}": ${String(error)}`,
      );
    }
  }
}
