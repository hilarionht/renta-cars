// docs/model/03-ENTITIES.md SS4.9 - a lo sumo una CheckOut y una CheckIn por Reservation
// (INV reforzado por unique(reservationId, type) a nivel de persistencia).
export type InspectionTypeValue = 'CheckOut' | 'CheckIn';
