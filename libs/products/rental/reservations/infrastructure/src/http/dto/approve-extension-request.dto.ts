import { IsDateString } from 'class-validator';

export class ApproveExtensionRequestDto {
  @IsDateString()
  newEndDate!: string;
}
