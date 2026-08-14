// docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS2.1: campos conceptuales del agregado,
// nunca `version` (se expone solo como ETag, docs/contracts/01-REST-STANDARDS.md SS8.1).
export class RoleResponseDto {
  id!: string;
  roleName!: string;
  scope!: string;
  status!: string;
  permissions!: string[];
}
