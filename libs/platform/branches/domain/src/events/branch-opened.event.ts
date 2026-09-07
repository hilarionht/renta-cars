// docs/model/06-DOMAIN_EVENTS.md SS4 - payload conceptual de BranchOpened.v1. Se emite tanto
// en create() como en reopen() - el nombre del evento describe el estado alcanzado
// ("Opened" = ahora Active), no solo el primer alta (simetrico con BranchClosed.v1).
export interface BranchOpenedEvent {
  eventType: 'BranchOpened.v1';
  branchId: string;
  companyId: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince?: string;
    postalCode?: string;
    country: string;
  };
}
