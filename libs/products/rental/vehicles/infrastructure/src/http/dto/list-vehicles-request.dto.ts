import { IsDateString, IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

// docs/persistence/10-DECISIONES.md #116: busqueda por disponibilidad, ambos o ninguno.
// companyId nunca es filtro de query (docs/contracts/01-REST-STANDARDS.md SS7). branchId si,
// como excepcion acotada (#135): solo filtra para usuarios sin sucursal en el token; si el
// token trae branchId, manda el del token.
export class ListVehiclesRequestDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  // #135: el handler ya lo soportaba pero el controller nunca lo pasaba. Se ignora si viene
  // startDate/endDate (la busqueda por disponibilidad fuerza la flota operable).
  @IsOptional()
  // Mismos valores que el enum VehicleStatus de prisma/schema/rental.prisma.
  @IsIn(['Registered', 'Available', 'Reserved', 'CheckedOut', 'Maintenance', 'OutOfService'])
  status?: string;

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
