import type { AuditLogEntry } from '@platform/audit/domain';

import type { AuditLogRepository } from '../../ports/audit-log.repository';
import { RecordAuditLogEntryHandler } from './record-audit-log-entry.handler';

function buildHandler() {
  const savedEntries: AuditLogEntry[] = [];
  const auditLogRepository: AuditLogRepository = {
    save: jest.fn((entry: AuditLogEntry) => {
      savedEntries.push(entry);
      return Promise.resolve();
    }),
  };

  const handler = new RecordAuditLogEntryHandler(auditLogRepository);

  return { handler, auditLogRepository, savedEntries };
}

describe('RecordAuditLogEntryHandler', () => {
  it('construye un AuditLogEntry desde el comando y lo persiste', async () => {
    const { handler, auditLogRepository, savedEntries } = buildHandler();
    const occurredAt = new Date('2026-08-16T23:18:36.732Z');

    await handler.execute({
      companyId: 'company-1',
      actorRef: 'user-1',
      action: 'BranchOpened.v1',
      subjectType: 'Branch',
      subjectId: 'branch-1',
      payload: { branchId: 'branch-1' },
      occurredAt,
    });

    expect(auditLogRepository.save).toHaveBeenCalledTimes(1);
    expect(savedEntries).toHaveLength(1);
    const entry = savedEntries[0];
    expect(entry.companyId).toBe('company-1');
    expect(entry.actorRef.toString()).toBe('user-1');
    expect(entry.action.toString()).toBe('BranchOpened.v1');
    expect(entry.subject.toSubjectType()).toBe('Branch');
    expect(entry.subject.toSubjectId()).toBe('branch-1');
    expect(entry.payload).toEqual({ branchId: 'branch-1' });
    expect(entry.occurredAt).toEqual(occurredAt);
  });

  it('acepta companyId null (evento global) y lo pasa sin cambios', async () => {
    const { handler, savedEntries } = buildHandler();

    await handler.execute({
      companyId: null,
      actorRef: 'system',
      action: 'SomePlatformEvent.v1',
      subjectType: 'Platform',
      subjectId: 'platform',
      payload: {},
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
    });

    expect(savedEntries[0].companyId).toBeNull();
  });

  it('propaga el error si actorRef/action/subject son invalidos (delega la validacion a los VOs)', async () => {
    const { handler } = buildHandler();

    await expect(
      handler.execute({
        companyId: 'company-1',
        actorRef: '',
        action: 'BranchOpened.v1',
        subjectType: 'Branch',
        subjectId: 'branch-1',
        payload: {},
        occurredAt: new Date(),
      }),
    ).rejects.toThrow(TypeError);
  });
});
