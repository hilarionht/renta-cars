import type { UnitOfWorkTransaction } from './unit-of-work';

// Puerto que application/ usa para publicar un evento de dominio dentro de la misma
// transaccion que el cambio de estado (docs/technical/04-PERSISTENCE.md SS4, Outbox). La
// implementacion real (OutboxWriter, libs/platform/persistence-kernel) escribe la fila en
// support.outbox_event Y emite via EventEmitter2 (best-effort, in-process) para que Audit
// (platform-audit-infrastructure) la consuma de inmediato - agregado cuando Audit se
// construyo (Fase 0 item 7), ver docs/persistence/10-DECISIONES.md.
export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');

export interface DomainEventToPublish {
  eventType: string; // "RoleCreated.v1"
  aggregateType: string;
  aggregateId: string;
  companyId: string | null;
  payload: Record<string, unknown>;
}

// Forma exacta que OutboxWriter emite via EventEmitter2 - DomainEventToPublish mas el
// timestamp que ya calcula para la fila de outbox_event (mismo valor en ambos lados).
export interface DomainEventEmitted extends DomainEventToPublish {
  occurredAt: Date;
}

export interface DomainEventPublisher {
  publish(tx: UnitOfWorkTransaction, event: DomainEventToPublish): Promise<void>;
}
