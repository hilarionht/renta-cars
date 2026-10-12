import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class VerifyCustomerOtpRequestDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
