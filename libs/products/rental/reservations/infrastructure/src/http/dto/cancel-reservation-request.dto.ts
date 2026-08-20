import { IsUUID } from 'class-validator';

export class CancelReservationRequestDto {
  @IsUUID()
  cancelledBy!: string;
}
