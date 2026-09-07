import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #116: ListVehiclesHandler valida startDate < endDate
// antes de consultar disponibilidad - sin esto, un rango invertido no matchea ningun
// AvailabilitySlot y devolveria "todo disponible" en silencio, mismo criterio de guard ya
// usado en reports (InvalidReportRangeError) para evitar ese bug silencioso.
export class InvalidDateRangeError extends DomainError {
  constructor(startDate: string, endDate: string) {
    super(
      `El rango de fechas es invalido: "startDate" (${startDate}) no es anterior a "endDate" (${endDate}).`,
    );
  }
}
