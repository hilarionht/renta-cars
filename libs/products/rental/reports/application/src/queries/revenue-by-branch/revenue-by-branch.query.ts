export interface RevenueByBranchQuery {
  companyId: string;
  from: string;
  to: string;
}

export interface RevenueByBranchItem {
  branchId: string;
  currency: string;
  billedRevenueMinorUnits: number;
}

export interface RevenueByBranchResult {
  items: RevenueByBranchItem[];
}
