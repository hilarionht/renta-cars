import { Type } from 'class-transformer';
import { IsArray, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class CancellationPolicyTierDto {
  @IsNumber()
  @Min(0)
  minHoursBeforeStart!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyPercentage!: number;
}

export class UpdateCancellationPolicyRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationPolicyTierDto)
  tiers!: CancellationPolicyTierDto[];
}
