import { FakeDocumentExtractionAdapter } from './fake-document-extraction.adapter';

describe('FakeDocumentExtractionAdapter', () => {
  it('devuelve siempre la misma sugerencia determinista, sin latencia simulada', async () => {
    const adapter = new FakeDocumentExtractionAdapter();

    const result = await adapter.extract();

    expect(result.documentType).toBe('NationalId');
    expect(result.expiryDate).toBeInstanceOf(Date);
    expect(result.expiryDate!.getTime()).toBeGreaterThan(Date.now());
    expect(result.confidenceByField).toEqual({ documentType: 0.95, expiryDate: 0.9 });
  });
});
