import type { RecordAuditLogEntryHandler } from '@platform/audit/application';
import type { PlatformAdminPrismaService, ReadTransaction } from '@platform/persistence-kernel';

import { ReservationReminderScanProcessor } from './reservation-reminder-scan.processor';

function buildProcessor(options: {
  companies?: { id: string }[];
  settingsByCompany?: Record<string, { reminderLeadTimeMinutes: number } | null>;
  reservationsByCompany?: Record<string, { id: string; customerId: string }[]>;
}) {
  const companies = options.companies ?? [];
  const settingsByCompany = options.settingsByCompany ?? {};
  const reservationsByCompany = options.reservationsByCompany ?? {};

  const scanQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const sendReminderQueue = { add: jest.fn().mockResolvedValue(undefined) };

  const platformAdminPrisma = {
    company: { findMany: jest.fn().mockResolvedValue(companies) },
  } as unknown as PlatformAdminPrismaService;

  const readTransaction = {
    run: jest.fn((work: (tx: unknown) => unknown, companyId: string) => {
      const tx = {
        companySettings: {
          findFirst: jest
            .fn()
            .mockResolvedValue(
              companyId in settingsByCompany ? settingsByCompany[companyId] : null,
            ),
        },
        reservation: {
          findMany: jest.fn().mockResolvedValue(reservationsByCompany[companyId] ?? []),
        },
      };
      return work(tx);
    }),
  } as unknown as ReadTransaction;

  const recordAuditLogEntry = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as RecordAuditLogEntryHandler;

  const processor = new ReservationReminderScanProcessor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scanQueue as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendReminderQueue as any,
    platformAdminPrisma,
    readTransaction,
    recordAuditLogEntry,
  );

  return { processor, scanQueue, sendReminderQueue, recordAuditLogEntry };
}

describe('ReservationReminderScanProcessor', () => {
  it('onModuleInit registra el job repetible via upsertJobScheduler', async () => {
    const { processor, scanQueue } = buildProcessor({});

    await processor.onModuleInit();

    expect(scanQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'reservation-reminder-scan',
      { every: 15 * 60 * 1000 },
      { name: 'scan' },
    );
  });

  it('audita el uso del bypass platform_admin con el conteo de companies enumeradas', async () => {
    const { processor, recordAuditLogEntry } = buildProcessor({
      companies: [{ id: 'company-1' }, { id: 'company-2' }],
    });

    await processor.process();

    expect(recordAuditLogEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: null,
        actorRef: 'system:reservation-reminder-scan',
        action: 'PlatformAdminBypassUsed',
        subjectType: 'Company',
        subjectId: 'all',
        payload: { companiesEnumerated: 2 },
      }),
    );
  });

  it('encola un job de send-reminder por cada Reservation vencida de cada company', async () => {
    const { processor, sendReminderQueue } = buildProcessor({
      companies: [{ id: 'company-1' }],
      settingsByCompany: { 'company-1': { reminderLeadTimeMinutes: 60 } },
      reservationsByCompany: {
        'company-1': [
          { id: 'reservation-1', customerId: 'customer-1' },
          { id: 'reservation-2', customerId: 'customer-2' },
        ],
      },
    });

    await processor.process();

    expect(sendReminderQueue.add).toHaveBeenCalledTimes(2);
    expect(sendReminderQueue.add).toHaveBeenCalledWith('send-reminder', {
      reservationId: 'reservation-1',
      companyId: 'company-1',
      customerId: 'customer-1',
    });
    expect(sendReminderQueue.add).toHaveBeenCalledWith('send-reminder', {
      reservationId: 'reservation-2',
      companyId: 'company-1',
      customerId: 'customer-2',
    });
  });

  it('una company sin CompanySettings se omite sin encolar nada ni romper', async () => {
    const { processor, sendReminderQueue } = buildProcessor({
      companies: [{ id: 'company-sin-settings' }],
      settingsByCompany: { 'company-sin-settings': null },
    });

    await expect(processor.process()).resolves.toBeUndefined();

    expect(sendReminderQueue.add).not.toHaveBeenCalled();
  });
});
