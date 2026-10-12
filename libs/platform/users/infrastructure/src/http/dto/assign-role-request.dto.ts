import { IsUUID } from 'class-validator';

export class AssignRoleRequestDto {
  @IsUUID()
  roleId!: string;
}
