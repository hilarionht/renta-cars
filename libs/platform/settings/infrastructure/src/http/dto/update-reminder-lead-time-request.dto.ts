import { IsNumber, Min } from 'class-validator';

export class UpdateReminderLeadTimeRequestDto {
  @IsNumber()
  @Min(1)
  leadTimeMinutes!: number;
}
