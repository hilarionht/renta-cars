import type { SlotKindValue } from '@platform/calendar/domain';

export interface OccupySlotCommand {
  companyId: string;
  resourceType: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  slotKind: SlotKindValue;
}
