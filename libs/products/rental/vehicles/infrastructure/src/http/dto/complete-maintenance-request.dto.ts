import { IsBoolean } from 'class-validator';

export class CompleteMaintenanceRequestDto {
  @IsBoolean()
  fitForService!: boolean;
}
