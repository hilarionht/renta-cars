import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateUserRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 200)
  password!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roles!: string[];
}
