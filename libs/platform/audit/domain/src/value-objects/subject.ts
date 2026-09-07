// docs/model/04-VALUE_OBJECTS.md SS7 / docs/persistence/02-TABLAS.md SS6.3 - tipo + ID del
// agregado afectado, deliberadamente generico (sin relacion tipada) para que Audit no
// dependa del modelo interno de cada Bounded Context que audita. subjectId es opaco (nunca
// UUID validado) - LoginFailed.v1 usa un email como subjectId, no todo evento tiene un
// aggregateId real.
export class Subject {
  private constructor(
    private readonly subjectType: string,
    private readonly subjectId: string,
  ) {}

  static from(params: { subjectType: string; subjectId: string }): Subject {
    if (params.subjectType.trim().length === 0 || params.subjectId.trim().length === 0) {
      throw new TypeError('Subject requiere subjectType y subjectId no vacios.');
    }
    return new Subject(params.subjectType.trim(), params.subjectId.trim());
  }

  toSubjectType(): string {
    return this.subjectType;
  }

  toSubjectId(): string {
    return this.subjectId;
  }
}
