import { VehicleDocumentExpiredError } from '../errors/vehicle-document-expired.error';
import { VehicleDocument } from './vehicle-document';

function uploadDocument(expiryDate = new Date('2030-01-01')): VehicleDocument {
  return VehicleDocument.upload({ documentType: 'PropertyCard', fileId: 'file-1', expiryDate });
}

describe('VehicleDocument', () => {
  describe('upload', () => {
    it('crea el documento en Pending', () => {
      const document = uploadDocument();

      expect(document.status).toBe('Pending');
    });
  });

  describe('verify', () => {
    it('transiciona Pending -> Verified', () => {
      const document = uploadDocument();

      document.verify();

      expect(document.status).toBe('Verified');
    });

    it('es idempotente si ya esta Verified', () => {
      const document = uploadDocument();
      document.verify();

      expect(() => document.verify()).not.toThrow();
      expect(document.status).toBe('Verified');
    });

    it('lanza VehicleDocumentExpiredError si el documento esta Expired', () => {
      const { id } = uploadDocument();
      const document = VehicleDocument.reconstitute({
        id,
        documentType: 'PropertyCard',
        fileId: 'file-1',
        expiryDate: new Date('2020-01-01'),
        status: 'Expired',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => document.verify()).toThrow(VehicleDocumentExpiredError);
    });
  });

  describe('isCurrentlyValid', () => {
    it('true solo si Verified y no vencido a la fecha dada', () => {
      const document = uploadDocument(new Date('2030-01-01'));
      document.verify();

      expect(document.isCurrentlyValid(new Date('2025-01-01'))).toBe(true);
      expect(document.isCurrentlyValid(new Date('2031-01-01'))).toBe(false);
    });

    it('false si nunca fue verificado', () => {
      const document = uploadDocument(new Date('2030-01-01'));

      expect(document.isCurrentlyValid(new Date('2025-01-01'))).toBe(false);
    });
  });
});
