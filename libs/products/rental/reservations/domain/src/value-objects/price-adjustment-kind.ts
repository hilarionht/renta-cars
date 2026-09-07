// docs/model/02-AGGREGATES.md SS11 - catalogo documentado de 4 valores
// (Extension/LateReturnPenalty/DamagePenalty/FuelDifference). Gap-fill: se agrega un 5to
// valor, CancellationPenalty, porque docs/model/08-STATE_MACHINES.md SS1.1 dice
// explicitamente que `cancel()` (RN-26) y `markNoShow()` (RN-19, "misma politica de
// cancelacion tardia") "pueden generar PriceAdjustment de penalidad" sin que ningun kind
// documentado encaje - LateReturnPenalty es semanticamente distinto (se genera en
// checkIn(), por una devolucion tardia de un alquiler YA entregado, no por una cancelacion
// antes de la entrega). Mismo criterio de gap-fill que DamageSeverity en Vehicles.
export type PriceAdjustmentKindValue =
  'Extension' | 'LateReturnPenalty' | 'DamagePenalty' | 'FuelDifference' | 'CancellationPenalty';
