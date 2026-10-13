import { encodeCursor, type ReadTransaction } from '@platform/persistence-kernel';

import { escapeLikePattern, ListCustomersHandler } from './list-customers.handler';

// docs/persistence/10-DECISIONES.md #135.
describe('ListCustomersHandler', () => {
  const record = (id: string) => ({
    id,
    name: `Cliente ${id}`,
    taxIdOrDocumentId: `DOC-${id}`,
    customerType: 'Individual',
    status: 'Active',
    blockStatus: 'NotBlocked',
  });

  function build(records: unknown[]) {
    const findMany = jest.fn().mockResolvedValue(records);
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work({ customer: { findMany } }),
    );
    const handler = new ListCustomersHandler({ run } as unknown as ReadTransaction);
    return { handler, findMany, run };
  }

  it('pagina por cursor, ordena por id desc y pasa companyId a la transaccion', async () => {
    const { handler, findMany, run } = build([record('c3'), record('c2'), record('c1')]);

    const result = await handler.execute({ companyId: 'company-1', limit: 2 });

    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      orderBy: { id: 'desc' },
      take: 3,
    });
    expect((run.mock.calls[0] as unknown[])[1]).toBe('company-1');
    expect(result.items.map((customer) => customer.id)).toEqual(['c3', 'c2']);
    expect(result.nextCursor).toBe(encodeCursor('c2'));
  });

  it('con q busca sin distinguir mayusculas en nombre, documento, email y telefono', async () => {
    const { handler, findMany } = build([]);

    await handler.execute({ companyId: 'company-1', q: '  ana ', cursor: encodeCursor('c9') });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'company-1',
          OR: [
            { name: { contains: 'ana', mode: 'insensitive' } },
            { taxIdOrDocumentId: { contains: 'ana', mode: 'insensitive' } },
            { contactEmail: { contains: 'ana', mode: 'insensitive' } },
            { contactPhone: { contains: 'ana' } },
          ],
          id: { lt: 'c9' },
        },
      }),
    );
  });

  it('escapa los comodines de LIKE para que q=% o q=_ busquen el caracter literal', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('un q vacio no filtra; la ultima pagina devuelve nextCursor null', async () => {
    const { handler, findMany } = build([record('c1')]);

    const result = await handler.execute({ companyId: 'company-1', q: '   ' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1' } }),
    );
    expect(result.nextCursor).toBeNull();
    expect(result.limit).toBe(25);
  });
});
