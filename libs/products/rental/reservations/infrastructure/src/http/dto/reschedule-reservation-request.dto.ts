import { IsDateString } from 'class-validator';

export class RescheduleReservationRequestDto {
  @IsDateString()
  newStartDate!: string;

  @IsDateString()
  newEndDate!: string;
}
