export interface ListRolesQuery {
  companyId: string;
}

export interface RoleSummary {
  id: string;
  roleName: string;
  scope: string;
  status: string;
  permissions: string[];
}
