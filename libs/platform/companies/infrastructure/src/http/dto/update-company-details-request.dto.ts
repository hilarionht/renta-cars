import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCompanyDetailsRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  legalName?: string;

  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  billingContactPhone?: string;
}
