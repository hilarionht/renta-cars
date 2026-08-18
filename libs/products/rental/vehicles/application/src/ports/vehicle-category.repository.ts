import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { VehicleCategory, VehicleCategoryId } from '@rental/vehicles/domain';

export const VEHICLE_CATEGORY_REPOSITORY = Symbol('VehicleCategoryRepository');

export interface VehicleCategoryRepository {
  findById(id: VehicleCategoryId): Promise<VehicleCategory | null>;
  save(category: VehicleCategory, tx: UnitOfWorkTransaction): Promise<void>;
}
