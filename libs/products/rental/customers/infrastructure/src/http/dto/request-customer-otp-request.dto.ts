import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RequestCustomerOtpRequestDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}
