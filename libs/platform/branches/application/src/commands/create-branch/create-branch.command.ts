import type { DaySchedule } from '@platform/branches/domain';

export interface CreateBranchCommand {
  companyId: string;
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
}
