import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateReservationRequestDto {
  @IsUUID('7')
  customerId!: string;

  @IsUUID('7')
  vehicleId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  authorizedDriverIds?: string[];
}
