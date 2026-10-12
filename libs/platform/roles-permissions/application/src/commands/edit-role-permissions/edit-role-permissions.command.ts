export interface EditRolePermissionsCommand {
  roleId: string;
  companyId: string;
  permissions: string[];
}
