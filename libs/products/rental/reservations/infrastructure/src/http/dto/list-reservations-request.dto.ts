import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

// Union en un unico DTO (customerId/vehicleId/status YA existian sueltos via @Query('x'),
// cursor/limit son nuevos) - obligatorio: @Query() sin nombre de argumento valida el objeto
// query completo contra una unica clase, y el ValidationPipe global tiene
// forbidNonWhitelisted:true (main.ts) - si cursor/limit vivieran en un DTO propio,
// customerId/vehicleId/status quedarian "sin declarar" y la request se rechazaria entera.
// status se deja @IsString() suelto, sin @IsIn contra el enum - misma laxitud que el
// comportamiento actual (bug de tipado separado en list-reservations.handler.ts, fuera de
// alcance de esta tanda de paginacion).
export class ListReservationsRequestDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  // @Type(Number) explicito: main.ts tiene transform:true pero sin enableImplicitConversion,
  // asi que class-transformer no coacciona el string de query a number por si solo.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
