import { IsIn, Matches } from 'class-validator';

import { WEEKDAYS, type Weekday } from '@platform/branches/domain';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DayScheduleDto {
  @IsIn(WEEKDAYS)
  day!: Weekday;

  @Matches(TIME_PATTERN)
  open!: string;

  @Matches(TIME_PATTERN)
  close!: string;
}
