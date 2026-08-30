export interface UploadIdentityDocumentCommand {
  customerId: string;
  companyId: string;
  documentType: string;
  fileId: string;
  expiryDate: Date;
  // Si se provee, el documento pertenece a ese AdditionalDriver (debe pertenecer a este
  // Customer); si se omite, pertenece al propio Customer.
  additionalDriverId?: string;
  // true si el operador uso ExtractIdentityDocumentHandler (OCR) y confirmo/edito la
  // sugerencia antes de este upload. Default false (captura 100% manual).
  extractedByOcr?: boolean;
}
