import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Mismo shape de paginacion que ListReservationsRequestDto (#112).
export class ListUsersRequestDto {
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
