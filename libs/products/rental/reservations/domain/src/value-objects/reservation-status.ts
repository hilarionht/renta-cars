// docs/model/08-STATE_MACHINES.md SS1 - 6 estados. NoShow no es un estado propio (razon de
// llegar a Cancelled, ver reservation.ts cancel()).
export type ReservationStatusValue =
  'Draft' | 'Confirmed' | 'CheckedOut' | 'CheckedIn' | 'Closed' | 'Cancelled';
