import type { DaySchedule } from '@platform/branches/domain';

export interface UpdateBranchCommand {
  branchId: string;
  companyId: string;
  name?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince?: string;
    postalCode?: string;
    country: string;
  };
  operatingHours?: DaySchedule[];
}
