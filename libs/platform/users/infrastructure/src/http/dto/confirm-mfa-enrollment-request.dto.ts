import { IsString, Length } from 'class-validator';

export class ConfirmMfaEnrollmentRequestDto {
  @IsString()
  secret!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
