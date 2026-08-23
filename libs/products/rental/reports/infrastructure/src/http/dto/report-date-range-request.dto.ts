import { IsDateString } from 'class-validator';

// Compartido por los 4 endpoints de reports (from/to) - mismo patron que
// CheckAvailabilityRequestDto (@platform/calendar/infrastructure). Sin validacion
// cross-field (`from <= to`) aca - el guard vive en cada Query Handler (docs/persistence/
// 10-DECISIONES.md Fase 4, item 1, sin precedente de @Validate() custom en el repo).
export class ReportDateRangeRequestDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
