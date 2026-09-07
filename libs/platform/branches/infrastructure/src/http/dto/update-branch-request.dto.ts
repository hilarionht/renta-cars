import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

import { AddressDto } from './address.dto';
import { DayScheduleDto } from './day-schedule.dto';

export class UpdateBranchRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  operatingHours?: DayScheduleDto[];
}
