export interface CreateRoleCommand {
  companyId: string;
  roleName: string;
  permissions: string[];
}
