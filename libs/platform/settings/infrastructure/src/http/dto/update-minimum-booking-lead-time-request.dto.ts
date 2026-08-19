import { IsNumber, Min } from 'class-validator';

export class UpdateMinimumBookingLeadTimeRequestDto {
  @IsNumber()
  @Min(0)
  leadTimeMinutes!: number;
}
