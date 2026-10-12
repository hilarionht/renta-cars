// RN-27: el catalogo real de tipos obligatorios es dependiente de pais/configurable, sin
// VO formal en los docs. Gap-filled con los 3 ejemplos del propio doc (docs/model/
// 02-AGGREGATES.md SS8): tarjeta de propiedad, seguro, permiso de circulacion - mismo
// criterio que Customer.DocumentType.
export type VehicleDocumentTypeValue = 'PropertyCard' | 'Insurance' | 'CirculationPermit';
