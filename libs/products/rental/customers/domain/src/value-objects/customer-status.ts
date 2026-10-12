// Ciclo de documentacion de Customer - docs/model/08-STATE_MACHINES.md SS6.5 (leido junto a
// CustomerBlockStatus, ver customer-block-status.ts, como dos dimensiones ortogonales, no
// una unica cadena de 3 estados - docs/persistence/10-DECISIONES.md tiene la resolucion
// completa). Registered -> Active via validateDocumentation() (efecto lateral de
// verifyIdentityDocument(), sin endpoint ni evento propio).
export type CustomerStatus = 'Registered' | 'Active';
