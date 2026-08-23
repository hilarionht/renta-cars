import { IsBoolean, IsInt, IsOptional, IsPositive } from 'class-validator';

// Sin validacion cross-field ("applies=true exige al menos un umbral") a nivel de DTO - sin
// precedente de @Validate() custom en el repo (mismo criterio ya documentado para
// reports/infrastructure, docs/persistence/10-DECISIONES.md Fase 4 item 1). La regla real
// vive en MaintenanceThresholdPolicy.from() (dominio) como backstop.
export class UpdateMaintenanceThresholdPolicyRequestDto {
  @IsBoolean()
  applies!: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  odometerThresholdKm?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  daysThreshold?: number;
}
