import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ListAuditLogRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  subjectType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  subjectId?: string;

  // #140: filtro por fecha del evento (ISO 8601) y paginado por cursor.
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  // @Type(Number) explicito: main.ts tiene transform:true pero sin enableImplicitConversion.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
