import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// docs/persistence/10-DECISIONES.md #135: GET /customers?q=&cursor=&limit=. Mismo criterio
// de cursor/limit que ListReservationsRequestDto (#112).
export class ListCustomersRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
