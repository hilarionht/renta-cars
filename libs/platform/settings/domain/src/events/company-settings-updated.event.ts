// docs/model/06-DOMAIN_EVENTS.md SS4 - evento unico y generico (no uno por politica), el
// nombre de la politica cambiada viaja en el payload. newValueSummary: JSON.stringify del
// nuevo valor (formato no especificado en los docs, resuelto con la opcion mas simple).
export interface CompanySettingsUpdatedEvent {
  eventType: 'CompanySettingsUpdated.v1';
  companyId: string;
  policyName: string;
  newValueSummary: string;
}
