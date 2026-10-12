import type { ReadTransaction } from '@platform/persistence-kernel';

import { PrismaSettingsLookupAdapter } from './prisma-settings-lookup.adapter';

// Regresion de docs/persistence/10-DECISIONES.md #131: SendNotificationHandler llama a este
// adaptador desde el worker BullMQ del Reminder, donde no existe RequestContext. Si un metodo
// no pasa su companyId a ReadTransaction.run(), cae al RequestContext ambiente y falla
// ("RequestContext no inicializado") - el recordatorio quedaba en Pending para siempre.
describe('PrismaSettingsLookupAdapter', () => {
  const companyId = 'company-1';
  const findFirst = jest.fn().mockResolvedValue(null);
  const run = jest.fn((work: (tx: unknown) => Promise<unknown>) =>
    work({ companySettings: { findFirst } }),
  );
  const adapter = new PrismaSettingsLookupAdapter({ run } as unknown as ReadTransaction);

  beforeEach(() => {
    run.mockClear();
  });

  it.each([
    ['getEnabledProductModules', () => adapter.getEnabledProductModules(companyId)],
    ['getCancellationPolicy', () => adapter.getCancellationPolicy(companyId)],
    ['getLateReturnPolicy', () => adapter.getLateReturnPolicy(companyId)],
    ['getDraftExpirationPolicyMinutes', () => adapter.getDraftExpirationPolicyMinutes(companyId)],
    ['getMinimumBookingLeadTimeMinutes', () => adapter.getMinimumBookingLeadTimeMinutes(companyId)],
    ['getDepositPolicy', () => adapter.getDepositPolicy(companyId)],
    ['getPaymentMethodsEnabled', () => adapter.getPaymentMethodsEnabled(companyId)],
    ['getNotificationChannelPreference', () => adapter.getNotificationChannelPreference(companyId)],
    ['getMaintenanceThresholdPolicy', () => adapter.getMaintenanceThresholdPolicy(companyId)],
  ])('%s pasa su companyId explicito a ReadTransaction.run()', async (_name, call) => {
    await call();

    expect(run).toHaveBeenCalledTimes(1);
    // Segundo argumento de run(work, companyId).
    expect((run.mock.calls[0] as unknown[])[1]).toBe(companyId);
  });
});
