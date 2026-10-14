export interface CheckAvailabilityQuery {
  companyId: string;
  resourceType: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  // docs/persistence/10-DECISIONES.md #136: ignora los slots de esta referencia (p.ej. la propia
  // reserva al reprogramarla o extenderla, que si no choca consigo misma).
  excludeReferenceId?: string;
}

export interface CheckAvailabilityResult {
  available: boolean;
}
