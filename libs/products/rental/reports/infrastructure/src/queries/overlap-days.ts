const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Funcion pura (sin Prisma) - dias de solape entre un slot de ocupacion y el rango
// consultado, en dias fraccionarios (los AvailabilitySlot/Reservation manejan datetime
// completo, no solo fecha - docs/persistence/10-DECISIONES.md Fase 4, item 1). 0 si no hay
// solape, nunca negativo.
export function overlapDays(
  slotStart: Date,
  slotEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const overlapStartMs = Math.max(slotStart.getTime(), rangeStart.getTime());
  const overlapEndMs = Math.min(slotEnd.getTime(), rangeEnd.getTime());
  const overlapMs = overlapEndMs - overlapStartMs;
  if (overlapMs <= 0) {
    return 0;
  }
  return overlapMs / MS_PER_DAY;
}
