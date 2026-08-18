// docs/model/08-STATE_MACHINES.md SS2 - enum cerrado de 6 valores. Reserved/CheckedOut no
// son alcanzables por ningun comando esta tanda (comandos derivados de Reservation, no
// construida) - se modelan igual porque son parte del contrato de datos persistido.
export type VehicleStatusValue =
  'Registered' | 'Available' | 'Reserved' | 'CheckedOut' | 'Maintenance' | 'OutOfService';
