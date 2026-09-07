import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const MAINTENANCE_TYPES = ['Preventive', 'Corrective'] as const;

export class ScheduleMaintenanceRequestDto {
  @IsIn(MAINTENANCE_TYPES)
  type!: string;

  @IsDateString()
  scheduledStart!: string;

  @IsDateString()
  scheduledEnd!: string;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;
}
