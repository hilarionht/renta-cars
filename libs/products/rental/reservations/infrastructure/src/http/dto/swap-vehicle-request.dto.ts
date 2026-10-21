import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SwapVehicleRequestDto {
  @IsUUID('7')
  newVehicleId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
