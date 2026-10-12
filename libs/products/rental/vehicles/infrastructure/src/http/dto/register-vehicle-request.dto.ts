import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RegisterVehicleRequestDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  vehicleCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @IsString()
  @IsNotEmpty()
  vin!: string;
}
