import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class UpdateDepositPolicyRequestDto {
  @IsBoolean()
  applies!: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentageOfTotal!: number;
}
