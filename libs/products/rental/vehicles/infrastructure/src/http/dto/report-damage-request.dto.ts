import { IsIn, IsOptional, IsString } from 'class-validator';

const DAMAGE_SEVERITIES = ['Minor', 'Severe'] as const;

export class ReportDamageRequestDto {
  @IsIn(DAMAGE_SEVERITIES)
  severity!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
