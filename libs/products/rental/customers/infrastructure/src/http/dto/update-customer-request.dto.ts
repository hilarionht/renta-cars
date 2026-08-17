import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCustomerRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
