import { IsString, Length } from 'class-validator';

export class ChangePasswordRequestDto {
  @IsString()
  @Length(12, 200)
  newPassword!: string;
}
