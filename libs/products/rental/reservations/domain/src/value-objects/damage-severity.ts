// Mismo catalogo que VehicleDocumentType/DamageSeverity de Vehicles (docs/model/
// 04-VALUE_OBJECTS.md SS5.1: "Minor | Severe") pero definido localmente, no importado
// cross-modulo - cada modulo scope:product-rental es dueño de su propio vocabulario aunque
// los valores coincidan (mismo criterio de aislamiento que evita que reservations importe
// tipos de vehicles/domain, INV-P03).
export type DamageSeverityValue = 'Minor' | 'Severe';
