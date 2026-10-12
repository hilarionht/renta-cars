export interface CreateUserCommand {
  companyId: string;
  branchId?: string;
  email: string;
  password: string;
  name: string;
  roles: string[];
}
