import { IsString, Length } from 'class-validator';

export class RegisterAdditionalDriverRequestDto {
  @IsString()
  @Length(2, 120)
  name!: string;
}
