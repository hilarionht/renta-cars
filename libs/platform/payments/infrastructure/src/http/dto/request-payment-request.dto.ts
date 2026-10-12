import { IsIn, IsInt, IsString, IsUUID, Min } from 'class-validator';

const PAYMENT_TARGET_TYPES = ['Invoice', 'SecurityDeposit'] as const;

export class RequestPaymentRequestDto {
  @IsIn(PAYMENT_TARGET_TYPES)
  targetType!: 'Invoice' | 'SecurityDeposit';

  @IsUUID()
  targetId!: string;

  @IsInt()
  @Min(1)
  amountMinorUnits!: number;

  @IsString()
  currency!: string;

  @IsString()
  method!: string;

  @IsString()
  idempotencyKey!: string;
}
