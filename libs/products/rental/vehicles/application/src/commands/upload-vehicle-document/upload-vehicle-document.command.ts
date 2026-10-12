export interface UploadVehicleDocumentCommand {
  vehicleId: string;
  companyId: string;
  documentType: string;
  fileId: string;
  expiryDate: Date;
}
