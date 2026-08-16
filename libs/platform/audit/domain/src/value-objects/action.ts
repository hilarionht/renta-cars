// docs/model/04-VALUE_OBJECTS.md SS7 - nombre del evento/comando auditado. Valida solo la
// FORMA (docs/technical/09-CODING-STANDARDS.md SS11: todo eventType termina en ".vN"), no
// un catalogo cerrado de nombres conocidos - Audit "observa todo" (docs/model/
// 06-DOMAIN_EVENTS.md SS9) sin necesidad de mantener una lista duplicada de cada evento que
// exista hoy o se agregue despues en cualquier modulo.
const ACTION_PATTERN = /^[A-Za-z]+\.v\d+$/;

export class Action {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): Action {
    if (!ACTION_PATTERN.test(raw)) {
      throw new TypeError(`Action debe tener la forma "Nombre.vN": "${raw}"`);
    }
    return new Action(raw);
  }

  toString(): string {
    return this.value;
  }
}
