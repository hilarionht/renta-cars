import { Injectable } from '@nestjs/common';

import type { DocumentExtractionPort, ExtractedDocumentFields } from '@platform/files/application';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// Default de desarrollo/test - determinista, sin latencia simulada, mismo criterio que
// FakeNotificationSenderAdapter/FakePaymentGatewayAdapter. Sin proveedor real decidido (no
// AWS Textract, no Google Vision, sin credenciales) - mismo tipo de gap de credenciales ya
// aceptado historicamente para Stripe/MercadoPago antes de construirse reales. Sin toggle
// (DOCUMENT_EXTRACTION_PROVIDER) - a diferencia de PAYMENT_GATEWAY_PORT/
// NOTIFICATION_SENDER_PORT, que siempre tuvieron >=2 opciones reales desde el dia 1, aca no
// hay ninguna alternativa real que alternar todavia (mismo criterio que
// PUSH_NOTIFICATION_SENDER_PORT). Sin persistencia - a diferencia de FakeNotificationSenderAdapter,
// aca no hay ningun secreto que un e2e necesite recuperar despues. Sin usar fileId - siempre
// la misma sugerencia determinista, ningun parametro que ignorar (implementacion valida con
// menos parametros que la interfaz, TypeScript lo permite por compatibilidad estructural).
@Injectable()
export class FakeDocumentExtractionAdapter implements DocumentExtractionPort {
  extract(): Promise<ExtractedDocumentFields> {
    return Promise.resolve({
      documentType: 'NationalId',
      expiryDate: new Date(Date.now() + MS_PER_YEAR),
      confidenceByField: { documentType: 0.95, expiryDate: 0.9 },
    });
  }
}
