import type { DaySchedule } from '@platform/branches/domain';

export class BranchResponseDto {
  id!: string;
  name!: string;
  address!: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince?: string;
    postalCode?: string;
    country: string;
  };
  operatingHours!: DaySchedule[];
  timeZone!: string;
  status!: string;
}
