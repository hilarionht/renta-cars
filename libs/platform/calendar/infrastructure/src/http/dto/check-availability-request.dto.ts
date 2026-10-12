import { IsDateString, IsString } from 'class-validator';

export class CheckAvailabilityRequestDto {
  @IsString()
  resourceType!: string;

  @IsString()
  resourceId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
