// docs/model/04-VALUE_OBJECTS.md SS4 / docs/domain/02-LENGUAJE-UBICUO.md SS5: Booking
// (referenceId opaco, tipicamente un ReservationId que Scheduling nunca tipa como tal) |
// Blackout (bloqueo manual, sin referenceId, motivo libre). Union type discriminada, mismo
// criterio que IdentityDocumentOwner en Customers - no una clase VO con estado propio.
export type SlotKindValue =
  { type: 'Booking'; referenceId: string } | { type: 'Blackout'; reason?: string };
