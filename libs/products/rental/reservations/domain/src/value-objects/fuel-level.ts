// Gap-fill (Reservations) - RN-18 habla de "nivel registrado en el Check-out" y politica
// "tanque lleno" sin fijar una escala concreta. Modelado como porcentaje 0-100 (forma
// minima esta tanda, sin catalogo de fracciones tipo Empty/Quarter/Half/Full - mismo
// pragmatismo ya usado para LicensePlate/RateUnit en Vehicles).
export class FuelLevel {
  private constructor(private readonly percentage: number) {}

  static from(percentage: number): FuelLevel {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new TypeError(`FuelLevel debe estar entre 0 y 100: ${percentage}`);
    }
    return new FuelLevel(percentage);
  }

  get value(): number {
    return this.percentage;
  }
}
