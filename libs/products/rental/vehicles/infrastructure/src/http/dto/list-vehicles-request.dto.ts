import { IsDateString, ValidateIf } from 'class-validator';

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
}
