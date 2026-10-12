// VO minimo compartido - docs/model/04-VALUE_OBJECTS.md SS1.2, catalogado como
// "verdaderamente universal" junto a Money/Email/PhoneNumber/EntityId, pero nunca
// implementado hasta esta tanda (Calendar) - mismo tipo de hueco que Money antes de
// Vehicles. endDate SIEMPRE estrictamente posterior a startDate (sin vigencia abierta -
// distinto de VehicleCategory.Rate.validTo, que por eso nunca reutilizo este VO, ver
// docs/persistence/10-DECISIONES.md #48).
export class DateRange {
  private readonly startDate: Date;
  private readonly endDate: Date;

  private constructor(startDate: Date, endDate: Date) {
    this.startDate = startDate;
    this.endDate = endDate;
  }

  static from(startDate: Date, endDate: Date): DateRange {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new TypeError('DateRange: endDate debe ser posterior a startDate.');
    }
    return new DateRange(startDate, endDate);
  }

  get start(): Date {
    return this.startDate;
  }

  get end(): Date {
    return this.endDate;
  }

  overlaps(other: DateRange): boolean {
    return (
      this.startDate.getTime() < other.endDate.getTime() &&
      other.startDate.getTime() < this.endDate.getTime()
    );
  }

  equals(other: DateRange): boolean {
    return (
      this.startDate.getTime() === other.startDate.getTime() &&
      this.endDate.getTime() === other.endDate.getTime()
    );
  }
}
