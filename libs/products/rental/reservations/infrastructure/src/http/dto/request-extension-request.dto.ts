import { IsDateString } from 'class-validator';

export class RequestExtensionRequestDto {
  @IsDateString()
  requestedNewEndDate!: string;
}
