import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const DAMAGE_SEVERITIES = ['Minor', 'Severe'] as const;

export class CheckInDamageRequestDto {
  @IsString()
  description!: string;

  @IsIn(DAMAGE_SEVERITIES)
  severity!: string;

  @IsBoolean()
  imputableToCustomer!: boolean;

  @IsArray()
  @IsString({ each: true })
  photoFileIds!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyAmountMinorUnits?: number;
}

export class CheckInReservationRequestDto {
  @IsNumber()
  @Min(0)
  odometer!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fuelLevelPercentage!: number;

  @IsArray()
  @IsString({ each: true })
  photoFileIds!: string[];

  @IsUUID()
  inspectedBy!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckInDamageRequestDto)
  damages?: CheckInDamageRequestDto[];
}
