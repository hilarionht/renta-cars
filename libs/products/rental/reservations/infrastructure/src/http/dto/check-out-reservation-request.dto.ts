import { IsArray, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';

export class CheckOutReservationRequestDto {
  @IsNumber()
  @Min(0)
  odometer!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fuelLevelPercentage!: number;

  @IsArray()
  @IsString({ each: true })
  photoFileIds!: string[];

  @IsUUID()
  inspectedBy!: string;
}
