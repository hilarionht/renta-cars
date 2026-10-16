// docs/persistence/10-DECISIONES.md #140. Puerto definido en platform e implementado por un
// producto (rental: reservas cuyo vehiculo es de la sucursal). INV-P03: platform nunca importa
// un producto - el enlace se hace en la raiz de composicion (apps/api). Es opcional: sin
// implementacion (otro producto, o tests de branches solo) se asume que no hay reservas.
export const BRANCH_ACTIVE_RESERVATIONS_PORT = Symbol('BranchActiveReservationsPort');

export interface BranchActiveReservationsPort {
  // Reservas Confirmed o CheckedOut que dependen de la sucursal.
  findActiveReservationIds(companyId: string, branchId: string): Promise<string[]>;
}
