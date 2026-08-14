import { ArrayMinSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

// docs/05-CONVENCIONES-BACKEND.md SS2: <Accion><Recurso>RequestDto. companyId nunca viaja
// aca (docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS1.1) - se deriva del token.
export class CreateRoleRequestDto {
  @IsString()
  @Length(2, 60)
  roleName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
