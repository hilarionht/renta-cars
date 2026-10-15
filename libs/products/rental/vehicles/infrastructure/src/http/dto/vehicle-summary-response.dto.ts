export class VehicleCategorySummaryResponseDto {
  id!: string;
  name!: string;
}

export class VehicleReservationRefResponseDto {
  id!: string;
  status!: string;
  startDate!: string;
  endDate!: string;
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
  // Solo para el personal (docs/persistence/10-DECISIONES.md #137).
  activeReservation?: VehicleReservationRefResponseDto;
}
