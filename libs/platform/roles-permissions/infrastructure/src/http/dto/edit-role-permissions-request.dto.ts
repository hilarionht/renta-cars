import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class EditRolePermissionsRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
