// docs/model/04-VALUE_OBJECTS.md SS5.1 - "lectura de kilometraje en un instante"; el
// historico se preserva porque cada Inspection (entidad) tiene su propio Odometer
// inmutable, no porque Odometer en si sea una entidad.
export class Odometer {
  private constructor(private readonly kilometers: number) {}

  static from(kilometers: number): Odometer {
    if (!Number.isFinite(kilometers) || kilometers < 0) {
      throw new TypeError(`Odometer debe ser un numero no negativo: ${kilometers}`);
    }
    return new Odometer(kilometers);
  }

  get value(): number {
    return this.kilometers;
  }
}
