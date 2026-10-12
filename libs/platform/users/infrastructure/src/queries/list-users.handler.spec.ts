import { encodeCursor, type ReadTransaction } from '@platform/persistence-kernel';

import { ListUsersHandler } from './list-users.handler';

// docs/persistence/10-DECISIONES.md #134.
describe('ListUsersHandler', () => {
  const record = (id: string) => ({
    id,
    email: `${id}@demo.local`,
    name: id,
    status: 'Active',
    branchId: null,
    roles: [],
  });

  function build(records: unknown[]) {
    const findMany = jest.fn().mockResolvedValue(records);
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) => work({ user: { findMany } }));
    const handler = new ListUsersHandler({ run } as unknown as ReadTransaction);
    return { handler, findMany, run };
  }

  it('con mas registros que el limite, devuelve una pagina y el cursor del ultimo', async () => {
    const { handler, findMany, run } = build([record('u3'), record('u2'), record('u1')]);

    const result = await handler.execute({ companyId: 'company-1', limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1' },
        orderBy: { id: 'desc' },
        take: 3,
      }),
    );
    expect((run.mock.calls[0] as unknown[])[1]).toBe('company-1');
    expect(result.items.map((user) => user.id)).toEqual(['u3', 'u2']);
    expect(result.nextCursor).toBe(encodeCursor('u2'));
    expect(result.limit).toBe(2);
  });

  it('en la ultima pagina, nextCursor es null', async () => {
    const { handler } = build([record('u1')]);

    const result = await handler.execute({ companyId: 'company-1' });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(result.limit).toBe(25);
  });

  it('con cursor, filtra por id menor al decodificado', async () => {
    const { handler, findMany } = build([]);

    await handler.execute({ companyId: 'company-1', cursor: encodeCursor('u5') });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', id: { lt: 'u5' } } }),
    );
  });
});
