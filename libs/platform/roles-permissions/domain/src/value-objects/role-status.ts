// Campo agregado al modelo de dominio documentado (decision tomada con el usuario durante
// esta tanda, no estaba en docs/model/02-AGGREGATES.md originalmente - ver actualizacion en
// ese documento y en docs/model/08-STATE_MACHINES.md en el mismo cambio). Solo aplica a
// scope=Custom: un role System nunca se desactiva (INV-026, ya cubierto por
// SystemRoleImmutableError sin necesidad de este campo para ese caso).
export type RoleStatus = 'Active' | 'Inactive';
