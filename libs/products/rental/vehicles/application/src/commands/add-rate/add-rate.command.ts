export interface AddRateCommand {
  vehicleCategoryId: string;
  companyId: string;
  amountMinorUnits: number;
  currency: string;
  unit: string;
  validFrom: Date;
  validTo?: Date;
}
