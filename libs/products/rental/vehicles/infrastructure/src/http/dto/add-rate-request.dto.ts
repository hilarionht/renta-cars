import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const RATE_UNITS = ['Day', 'Week'] as const;

export class AddRateRequestDto {
  @IsInt()
  @Min(0)
  amountMinorUnits!: number;

  @IsString()
  currency!: string;

  @IsIn(RATE_UNITS)
  unit!: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
