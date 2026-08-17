// docs/model/02-AGGREGATES.md SS10: "identidad, licencia de conducir" - catalogo cerrado de
// 2 valores, a diferencia de EnabledProductModules (conjunto abierto) - mismo criterio que
// PaymentMethod.
export type DocumentType = 'NationalId' | 'DriversLicense';
