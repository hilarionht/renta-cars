import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

// docs/persistence/10-DECISIONES.md #116: busqueda por disponibilidad, ambos o ninguno.
// branchId/companyId NO son filtros de query aceptados (docs/contracts/01-REST-STANDARDS.md
// SS7) - se derivan siempre del token, nunca del cliente.
export class ListVehiclesRequestDto {
  @ValidateIf(
    (dto: ListVehiclesRequestDto) => dto.startDate !== undefined || dto.endDate !== undefined,
  )
  @IsDateString()
  startDate?: string;

  @ValidateIf(
    (dto: ListVehiclesRequestDto) => dto.startDate !== undefined || dto.endDate !== undefined,
  )
  @IsDateString()
  endDate?: string;

  // docs/persistence/10-DECISIONES.md #123: primera implementacion real de `?expand=`
  // (docs/contracts/10-DECISIONES.md #3). Un solo valor de query, sin split por coma - un
  // solo valor soportado hoy ('vehicleCategory'), ListVehiclesHandler valida contra el
  // allow-list. Simplificacion deliberada: agregar un 2do valor es un cambio de una linea.
  @IsOptional()
  @IsString()
  expand?: string;
}
