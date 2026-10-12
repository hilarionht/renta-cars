import { IsNotEmpty, IsString } from 'class-validator';

// Motivo obligatorio si Blocked (docs/model/04-VALUE_OBJECTS.md SS5.1) - enforcement a nivel
// de DTO, mismo criterio que otros campos requeridos por regla de negocio explicita.
export class BlockCustomerRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
