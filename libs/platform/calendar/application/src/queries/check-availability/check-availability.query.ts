export interface CheckAvailabilityQuery {
  companyId: string;
  resourceType: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
}

export interface CheckAvailabilityResult {
  available: boolean;
}
