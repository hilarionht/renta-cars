import { IsOptional, IsString, Length } from 'class-validator';

export class ListAuditLogRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  subjectType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  subjectId?: string;
}
