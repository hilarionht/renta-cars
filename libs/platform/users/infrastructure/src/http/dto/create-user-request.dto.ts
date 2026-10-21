import {
  ArrayMinSize,
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
  @IsUUID('7')
  branchId?: string;

  @IsArray()
  // #140: un usuario sin roles no puede hacer nada; antes se aceptaba.
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roles!: string[];
}
