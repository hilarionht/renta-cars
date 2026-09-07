// docs/model/06-DOMAIN_EVENTS.md SS4 - payload conceptual de BranchClosed.v1.
export interface BranchClosedEvent {
  eventType: 'BranchClosed.v1';
  branchId: string;
  companyId: string;
}
