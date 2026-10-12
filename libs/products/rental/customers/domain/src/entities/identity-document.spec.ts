import { IdentityDocumentExpiredError } from '../errors/identity-document-expired.error';
import { IdentityDocument } from './identity-document';

function uploadDocument(expiryDate = new Date('2030-01-01')): IdentityDocument {
  return IdentityDocument.upload({
    owner: { type: 'Customer', id: 'customer-1' },
    documentType: 'NationalId',
    fileId: 'file-1',
    expiryDate,
  });
}

describe('IdentityDocument', () => {
  describe('upload', () => {
    it('crea el documento en Pending, con extractedByOcr false por defecto', () => {
      const document = uploadDocument();

      expect(document.status).toBe('Pending');
      expect(document.extractedByOcr).toBe(false);
    });

    it('crea el documento con extractedByOcr true si se pasa explicito', () => {
      const document = IdentityDocument.upload({
        owner: { type: 'Customer', id: 'customer-1' },
        documentType: 'NationalId',
        fileId: 'file-1',
        expiryDate: new Date('2030-01-01'),
        extractedByOcr: true,
      });

      expect(document.extractedByOcr).toBe(true);
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

    it('lanza IdentityDocumentExpiredError si el documento esta Expired', () => {
      const { id } = uploadDocument();
      const document = IdentityDocument.reconstitute({
        id,
        owner: { type: 'Customer', id: 'customer-1' },
        documentType: 'NationalId',
        fileId: 'file-1',
        expiryDate: new Date('2020-01-01'),
        status: 'Expired',
        extractedByOcr: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => document.verify()).toThrow(IdentityDocumentExpiredError);
    });
  });

  describe('isCurrentlyValid', () => {
    it('true solo si Verified y no vencido a la fecha dada', () => {
      const document = uploadDocument(new Date('2030-01-01'));
      document.verify();

      expect(document.isCurrentlyValid(new Date('2025-01-01'))).toBe(true);
      expect(document.isCurrentlyValid(new Date('2031-01-01'))).toBe(false);
    });

    it('false si nunca fue verificado, aunque no este vencido', () => {
      const document = uploadDocument(new Date('2030-01-01'));

      expect(document.isCurrentlyValid(new Date('2025-01-01'))).toBe(false);
    });
  });
});
