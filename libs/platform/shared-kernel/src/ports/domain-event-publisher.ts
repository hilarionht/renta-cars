import type { UnitOfWorkTransaction } from './unit-of-work';

// Puerto que application/ usa para publicar un evento de dominio dentro de la misma
// transaccion que el cambio de estado (docs/technical/04-PERSISTENCE.md SS4, Outbox). La
// implementacion real (apps/api) escribe la fila en support.outbox_event. Sin emision
// EventEmitter2 en proceso todavia - no hay ningun listener real (Audit, Fase 0 item 7, no
// existe en esta tanda) asi que agregar esa segunda via ahora seria complejidad sin
// consumidor, mismo criterio que ya se acepto para el OutboxRelayWorker (docs/persistence/
// 10-DECISIONES.md).
export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');

export interface DomainEventToPublish {
  eventType: string; // "RoleCreated.v1"
  aggregateType: string;
  aggregateId: string;
  companyId: string | null;
  payload: Record<string, unknown>;
}

export interface DomainEventPublisher {
  publish(tx: UnitOfWorkTransaction, event: DomainEventToPublish): Promise<void>;
}
