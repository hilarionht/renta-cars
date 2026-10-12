import { UserResponseDto } from './user-response.dto';

export class CurrentUserResponseDto extends UserResponseDto {
  companyId!: string;
  permissions!: string[];
}
