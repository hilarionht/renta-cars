import type { DaySchedule } from '@platform/branches/domain';

export interface GetBranchQuery {
  branchId: string;
  companyId: string;
}

export interface ListBranchesQuery {
  companyId: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince?: string;
    postalCode?: string;
    country: string;
  };
  operatingHours: DaySchedule[];
  status: string;
}
