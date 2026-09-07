// docs/model/02-AGGREGATES.md SS10 / 03-ENTITIES.md SS4.7: "Pending/Verified/Expired".
// docs/model/08-STATE_MACHINES.md SS6.7 (diagrama compartido con VehicleDocument) rotula el
// estado intermedio "Valid" - inconsistencia real entre docs, se trata "Verified" como
// autoritativo (2 de 3 documentos + persistencia coinciden), ver docs/persistence/
// 10-DECISIONES.md.
export type IdentityDocumentStatus = 'Pending' | 'Verified' | 'Expired';
