export class RateResponseDto {
  id!: string;
  amountMinorUnits!: number;
  currency!: string;
  unit!: string;
  validFrom!: string;
  validTo?: string;
}

export class VehicleCategoryResponseDto {
  id!: string;
  companyId!: string;
  name!: string;
  description?: string;
  rates!: RateResponseDto[];
}
