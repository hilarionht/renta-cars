import type { ReadTransaction } from '@platform/persistence-kernel';

import { CheckAvailabilityHandler } from './check-availability.handler';

// docs/persistence/10-DECISIONES.md #136.
describe('CheckAvailabilityHandler', () => {
  function build(found: unknown) {
    const findFirst = jest.fn().mockResolvedValue(found);
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work({ availabilitySlot: { findFirst } }),
    );
    return {
      handler: new CheckAvailabilityHandler({ run } as unknown as ReadTransaction),
      findFirst,
    };
  }

  const base = {
    companyId: 'company-1',
    resourceType: 'vehicle',
    resourceId: 'vehicle-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-10'),
  };

  it('sin exclusion considera cualquier slot Active superpuesto', async () => {
    const { handler, findFirst } = build({ id: 'slot-1' });

    await expect(handler.execute(base)).resolves.toEqual({ available: false });
    expect((findFirst.mock.calls[0] as [{ where: object }])[0].where).not.toHaveProperty('OR');
  });

  it('con excludeReferenceId ignora esa referencia pero sigue viendo los slots sin referencia', async () => {
    const { handler, findFirst } = build(null);

    await expect(
      handler.execute({ ...base, excludeReferenceId: 'reservation-1' }),
    ).resolves.toEqual({ available: true });
    expect((findFirst.mock.calls[0] as [{ where: object }])[0].where).toEqual(
      expect.objectContaining({
        OR: [{ referenceId: null }, { referenceId: { not: 'reservation-1' } }],
      }),
    );
  });
});
