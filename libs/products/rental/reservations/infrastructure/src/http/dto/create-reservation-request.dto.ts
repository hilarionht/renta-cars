import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateReservationRequestDto {
  @IsUUID()
  customerId!: string;

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
