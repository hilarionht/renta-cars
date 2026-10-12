export class VehicleCategorySummaryResponseDto {
  id!: string;
  name!: string;
}

export class VehicleSummaryResponseDto {
  id!: string;
  branchId!: string;
  vehicleCategoryId!: string;
  licensePlate!: string;
  vin!: string;
  status!: string;
  // Presente solo si se pidio ?expand=vehicleCategory (docs/persistence/10-DECISIONES.md #123).
  vehicleCategory?: VehicleCategorySummaryResponseDto;
}
