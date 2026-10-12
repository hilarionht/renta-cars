import { IsEmail, IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

const CUSTOMER_TYPES = ['Individual', 'Corporate'] as const;

export class RegisterCustomerRequestDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  taxIdOrDocumentId!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsIn(CUSTOMER_TYPES)
  customerType!: string;
}
