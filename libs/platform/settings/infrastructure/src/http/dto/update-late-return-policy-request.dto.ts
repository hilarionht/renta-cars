import { IsNumber, Min } from 'class-validator';

export class UpdateLateReturnPolicyRequestDto {
  @IsNumber()
  @Min(0)
  graceMinutes!: number;

  @IsNumber()
  @Min(0)
  penaltyPercentagePerHour!: number;
}
