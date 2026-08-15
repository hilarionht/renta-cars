import { IsOptional, IsString, Length } from 'class-validator';

export class AddressDto {
  @IsString()
  @Length(1, 200)
  line1!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  line2?: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  stateProvince?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @IsString()
  @Length(1, 100)
  country!: string;
}
