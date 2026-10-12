import { EntityId } from '@platform/shared-kernel';

import type { ActorRef } from '../value-objects/actor-ref';
import type { Action } from '../value-objects/action';
import type { Subject } from '../value-objects/subject';

export type AuditLogEntryId = EntityId<'AuditLogEntry'>;

export interface AuditLogEntryProps {
  id: AuditLogEntryId;
  companyId: string | null;
  actorRef: ActorRef;
  action: Action;
  subject: Subject;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS17. El agregado con menos comportamiento
// de todo el modelo: append-only estricto (INV-024), un unico estado terminal (Created), sin
// metodos de transicion, sin eventos propios (consumidor terminal - nunca publica), sin
// errores de dominio (no interpreta ni valida el contenido de negocio del evento que
// registra, solo lo transcribe). Sin `version` - a diferencia de todo otro aggregate root
// del modelo (docs/persistence/10-DECISIONES.md #5), nunca hay una segunda escritura con la
// que la primera pueda entrar en conflicto.
export class AuditLogEntry {
  private constructor(private readonly props: AuditLogEntryProps) {}

  static create(params: {
    companyId: string | null;
    actorRef: ActorRef;
    action: Action;
    subject: Subject;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }): AuditLogEntry {
    return new AuditLogEntry({
      id: EntityId.generate<'AuditLogEntry'>(),
      companyId: params.companyId,
      actorRef: params.actorRef,
      action: params.action,
      subject: params.subject,
      payload: params.payload,
      occurredAt: params.occurredAt,
    });
  }

  get id(): AuditLogEntryId {
    return this.props.id;
  }

  get companyId(): string | null {
    return this.props.companyId;
  }

  get actorRef(): ActorRef {
    return this.props.actorRef;
  }

  get action(): Action {
    return this.props.action;
  }

  get subject(): Subject {
    return this.props.subject;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}
