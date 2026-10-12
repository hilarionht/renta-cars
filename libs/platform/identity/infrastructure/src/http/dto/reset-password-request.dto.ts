import { IsString, Length } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsString()
  token!: string;

  @IsString()
  @Length(12, 200)
  newPassword!: string;
}
