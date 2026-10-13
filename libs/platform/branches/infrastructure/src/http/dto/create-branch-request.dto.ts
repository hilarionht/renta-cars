import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsTimeZone, Length, ValidateNested } from 'class-validator';

import { AddressDto } from './address.dto';
import { DayScheduleDto } from './day-schedule.dto';

export class CreateBranchRequestDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  operatingHours!: DayScheduleDto[];

  // IANA (docs/persistence/10-DECISIONES.md #135). Sin valor al crear: America/Argentina/Buenos_Aires.
  @IsOptional()
  @IsTimeZone()
  timeZone?: string;
}
