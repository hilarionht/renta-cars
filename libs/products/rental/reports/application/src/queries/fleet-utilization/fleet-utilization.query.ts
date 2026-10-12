export interface FleetUtilizationQuery {
  companyId: string;
  from: string;
  to: string;
}

export interface FleetUtilizationItem {
  vehicleId: string;
  branchId: string;
  occupiedDays: number;
  totalDays: number;
  utilizationPercentage: number;
}

export interface FleetUtilizationResult {
  fleetAverageUtilizationPercentage: number;
  items: FleetUtilizationItem[];
}
