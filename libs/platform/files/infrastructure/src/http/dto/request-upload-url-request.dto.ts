import { IsString } from 'class-validator';

export class RequestUploadUrlRequestDto {
  @IsString()
  contentType!: string;
}
