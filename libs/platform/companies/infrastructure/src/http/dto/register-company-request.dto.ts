import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class RegisterCompanyRequestDto {
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @IsString()
  @Length(1, 60)
  taxId!: string;

  @IsEmail()
  billingContactEmail!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  billingContactPhone?: string;
}
