import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

// Espejo de CreateReservationRequestDto sin customerId - el customerId siempre viene del
// access_token (request.user.sub), nunca del body (me-reservations.controller.ts).
export class CreateMyReservationRequestDto {
  @IsUUID()
  vehicleId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  authorizedDriverIds?: string[];
}
