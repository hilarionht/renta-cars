export interface CustomerActivityQuery {
  companyId: string;
  from: string;
  to: string;
  limit?: number;
}

export interface CustomerActivitySpend {
  currency: string;
  amountMinorUnits: number;
}

export interface CustomerActivityItem {
  customerId: string;
  customerName: string;
  reservationCount: number;
  spend: CustomerActivitySpend[];
}

export interface CustomerActivityResult {
  items: CustomerActivityItem[];
}
