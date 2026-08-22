import type { PriceBreakdownPayload } from './price-breakdown-payload';

export interface ReservationCheckedInEvent {
  eventType: 'ReservationCheckedIn.v1';
  reservationId: string;
  // Gap-fill (docs/persistence/10-DECISIONES.md #79): docs/model/06-DOMAIN_EVENTS.md SS6.3
  // no documenta customerId en este payload, pero Invoice/InvoiceIssued.v1 lo necesita
  // (invoices.customer_id es FK NOT NULL real, docs/persistence/03-RELACIONES.md SS2) - el
  // evento es la unica superficie de datos que Invoices puede consumir de Reservation
  // (docs/model/09-DEPENDENCIES.md SS4), asi que se agrega aca. Campo puramente aditivo,
  // Reservation.props.customerId ya existe y se emite igual en ReservationConfirmed.v1.
  customerId: string;
  vehicleId: string;
  inspectionId: string;
  priceBreakdown: PriceBreakdownPayload;
}
