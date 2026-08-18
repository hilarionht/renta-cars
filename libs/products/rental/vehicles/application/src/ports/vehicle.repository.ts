import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Vehicle, VehicleId } from '@rental/vehicles/domain';

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');

// Un unico repositorio para todo el aggregate - VehicleDocument/MaintenanceRecord son
// entidades internas de Vehicle, nunca tienen repositorio propio (DDD estandar, mismo
// criterio que CustomerRepository).
export interface VehicleRepository {
  findById(id: VehicleId): Promise<Vehicle | null>;
  save(vehicle: Vehicle, tx: UnitOfWorkTransaction): Promise<void>;
}
