import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

import { ReportDateRangeRequestDto } from './report-date-range-request.dto';

export class CustomerActivityRequestDto extends ReportDateRangeRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
