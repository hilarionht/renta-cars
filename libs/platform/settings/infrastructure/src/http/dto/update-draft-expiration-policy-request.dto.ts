import { IsNumber, Min } from 'class-validator';

export class UpdateDraftExpirationPolicyRequestDto {
  @IsNumber()
  @Min(1)
  expirationMinutes!: number;
}
