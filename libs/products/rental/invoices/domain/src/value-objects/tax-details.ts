// docs/model/04-VALUE_OBJECTS.md SS14 - "impuestos aplicados... reglas de calculo
// dependientes de pais (domain/03-PROCESOS.md SS9)". Sin ninguna regla de calculo real
// documentada todavia (docs/domain/03-PROCESOS.md linea 217, explicitamente diferido) - VO
// minimo, estructura presente para que una futura tanda pais-especifica la pueble, sin
// inventar ningun motor de calculo.
export class TaxDetails {
  private constructor(private readonly amountMinorUnits: number) {}

  static from(taxAmountMinorUnits: number): TaxDetails {
    if (!Number.isInteger(taxAmountMinorUnits) || taxAmountMinorUnits < 0) {
      throw new TypeError(
        `TaxDetails.taxAmountMinorUnits debe ser un entero no negativo: ${taxAmountMinorUnits}`,
      );
    }
    return new TaxDetails(taxAmountMinorUnits);
  }

  static zero(): TaxDetails {
    return new TaxDetails(0);
  }

  get taxAmountMinorUnits(): number {
    return this.amountMinorUnits;
  }
}
