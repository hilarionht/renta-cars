export interface CheckInDamageInput {
  description: string;
  severity: 'Minor' | 'Severe';
  imputableToCustomer: boolean;
  photoFileIds: string[];
  // Monto decidido por el Operador humano (docs/model/05-DOMAIN_SERVICES.md SS4.3:
  // PricingService nunca decide SI corresponde una penalidad por dano, solo el monto una
  // vez que la imputabilidad ya fue determinada por un humano) - omitido/0 = sin cargo.
  penaltyAmountMinorUnits?: number;
}

export interface CheckInReservationCommand {
  companyId: string;
  reservationId: string;
  odometer: number;
  fuelLevelPercentage: number;
  photoFileIds: string[];
  inspectedBy: string;
  damages?: CheckInDamageInput[];
}
