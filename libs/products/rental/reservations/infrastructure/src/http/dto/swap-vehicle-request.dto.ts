import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SwapVehicleRequestDto {
  @IsUUID()
  newVehicleId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
