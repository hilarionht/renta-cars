import { IsString } from 'class-validator';

export class ConfirmUploadRequestDto {
  @IsString()
  storageRef!: string;

  @IsString()
  contentType!: string;
}
