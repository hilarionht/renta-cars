import { IsInt, IsString, Min } from 'class-validator';

export class RetainSecurityDepositRequestDto {
  @IsInt()
  @Min(1)
  retainedAmountMinorUnits!: number;

  @IsString()
  currency!: string;

  @IsString()
  reason!: string;
}
