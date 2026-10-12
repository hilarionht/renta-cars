export interface VehicleCategoryCreatedEvent {
  eventType: 'VehicleCategoryCreated.v1';
  categoryId: string;
  companyId: string;
  name: string;
}
