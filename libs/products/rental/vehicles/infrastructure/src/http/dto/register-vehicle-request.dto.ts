import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RegisterVehicleRequestDto {
  @IsUUID('7')
  branchId!: string;

  @IsUUID('7')
  vehicleCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @IsString()
  @IsNotEmpty()
  vin!: string;
}
