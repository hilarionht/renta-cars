// docs/model/04-VALUE_OBJECTS.md SS7 - referencia generica a quien ejecuto la accion
// auditada, deliberadamente debil (un userId o un identificador de actor de sistema como
// string) para que Audit no dependa del modelo de Identity & Access.
export class ActorRef {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): ActorRef {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new TypeError('ActorRef no puede estar vacio.');
    }
    return new ActorRef(trimmed);
  }

  // Actor por defecto cuando el evento se origino en una ruta @Public() sin JWT (Login,
  // RegisterCompany) - RequestContext.tryGet() no tiene nada que ofrecer en ese caso.
  static system(): ActorRef {
    return new ActorRef('system');
  }

  toString(): string {
    return this.value;
  }
}
