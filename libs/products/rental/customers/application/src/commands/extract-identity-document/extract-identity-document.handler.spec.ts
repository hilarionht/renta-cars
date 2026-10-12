import type { DocumentExtractionPort } from '@platform/files/application';

import { ExtractIdentityDocumentHandler } from './extract-identity-document.handler';

describe('ExtractIdentityDocumentHandler', () => {
  it('devuelve la sugerencia del puerto cuando la extraccion es exitosa', async () => {
    const suggestion = {
      documentType: 'NationalId',
      expiryDate: new Date('2030-01-01'),
      confidenceByField: { documentType: 0.95 },
    };
    const documentExtractionPort: DocumentExtractionPort = {
      extract: jest.fn().mockResolvedValue(suggestion),
    };
    const handler = new ExtractIdentityDocumentHandler(documentExtractionPort);

    const result = await handler.execute({ fileId: 'file-1' });

    expect(documentExtractionPort.extract).toHaveBeenCalledWith('file-1');
    expect(result).toEqual(suggestion);
  });

  it('devuelve null (nunca propaga) si el puerto de extraccion falla', async () => {
    const documentExtractionPort: DocumentExtractionPort = {
      extract: jest.fn().mockRejectedValue(new Error('OCR provider caido')),
    };
    const handler = new ExtractIdentityDocumentHandler(documentExtractionPort);

    const result = await handler.execute({ fileId: 'file-1' });

    expect(result).toBeNull();
  });
});
