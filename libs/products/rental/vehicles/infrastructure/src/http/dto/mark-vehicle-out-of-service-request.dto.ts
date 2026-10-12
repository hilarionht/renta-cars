import { IsOptional, IsString } from 'class-validator';

export class MarkVehicleOutOfServiceRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
