import { IsOptional, IsString } from 'class-validator';

// docs/persistence/10-DECISIONES.md #135: GET /reservations/:id?expand=customer,vehicle
// (separados por coma; el handler valida contra el allow-list).
export class GetReservationRequestDto {
  @IsOptional()
  @IsString()
  expand?: string;
}
