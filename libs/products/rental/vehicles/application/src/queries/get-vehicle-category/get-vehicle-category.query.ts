export interface GetVehicleCategoryQuery {
  vehicleCategoryId: string;
  companyId: string;
}

export interface RateSummary {
  id: string;
  amountMinorUnits: number;
  currency: string;
  unit: string;
  validFrom: string;
  validTo?: string;
}

export interface VehicleCategoryDetail {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  rates: RateSummary[];
}

export interface ListVehicleCategoriesQuery {
  companyId: string;
}

export interface VehicleCategorySummary {
  id: string;
  name: string;
  description?: string;
}
