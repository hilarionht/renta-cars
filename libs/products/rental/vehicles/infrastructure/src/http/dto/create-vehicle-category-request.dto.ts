import { IsOptional, IsString, Length } from 'class-validator';

export class CreateVehicleCategoryRequestDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
