import { IsArray, IsString } from 'class-validator';

// Sin @ArrayNotEmpty() a proposito - un arreglo vacio es JSON valido (no un error de forma
// de la request), lo rechaza el dominio (EnabledProductModulesEmptyError -> 422, INV-018),
// no el ValidationPipe (400) - misma distincion tecnico/dominio de docs/contracts/
// 07-ERROR-CATALOG.md SS2.
export class UpdateEnabledProductModulesRequestDto {
  @IsArray()
  @IsString({ each: true })
  enabledProductModules!: string[];
}
