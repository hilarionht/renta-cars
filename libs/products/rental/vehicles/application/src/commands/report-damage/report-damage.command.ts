export interface ReportDamageCommand {
  vehicleId: string;
  companyId: string;
  severity: string;
  reason?: string;
}
