export interface GetUserQuery {
  userId: string;
  companyId: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  branchId?: string;
}
