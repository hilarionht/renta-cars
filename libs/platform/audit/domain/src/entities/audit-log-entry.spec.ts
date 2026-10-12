import { ActorRef } from '../value-objects/actor-ref';
import { Action } from '../value-objects/action';
import { Subject } from '../value-objects/subject';
import { AuditLogEntry } from './audit-log-entry';

function createEntry(params: { companyId?: string | null } = {}): AuditLogEntry {
  const companyId = Object.hasOwn(params, 'companyId') ? (params.companyId ?? null) : 'company-1';
  return AuditLogEntry.create({
    companyId,
    actorRef: ActorRef.from('user-1'),
    action: Action.from('BranchOpened.v1'),
    subject: Subject.from({ subjectType: 'Branch', subjectId: 'branch-1' }),
    payload: { branchId: 'branch-1' },
    occurredAt: new Date('2026-08-16T00:00:00.000Z'),
  });
}

describe('AuditLogEntry', () => {
  it('create() genera un id nuevo y expone todos los campos', () => {
    const entry = createEntry();

    expect(entry.id.toString()).toBeDefined();
    expect(entry.companyId).toBe('company-1');
    expect(entry.actorRef.toString()).toBe('user-1');
    expect(entry.action.toString()).toBe('BranchOpened.v1');
    expect(entry.subject.toSubjectType()).toBe('Branch');
    expect(entry.subject.toSubjectId()).toBe('branch-1');
    expect(entry.payload).toEqual({ branchId: 'branch-1' });
    expect(entry.occurredAt).toEqual(new Date('2026-08-16T00:00:00.000Z'));
  });

  it('create() acepta companyId null para eventos verdaderamente globales', () => {
    const entry = createEntry({ companyId: null });

    expect(entry.companyId).toBeNull();
  });

  it('create() de dos llamadas produce ids distintos', () => {
    const first = createEntry();
    const second = createEntry();

    expect(first.id.toString()).not.toBe(second.id.toString());
  });
});
