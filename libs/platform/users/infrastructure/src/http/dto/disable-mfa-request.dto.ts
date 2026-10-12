import { IsString, Length } from 'class-validator';

export class DisableMfaRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
