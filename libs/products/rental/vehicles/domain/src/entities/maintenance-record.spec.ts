import { MaintenanceRecordInvalidStateTransitionError } from '../errors/maintenance-record-invalid-state-transition.error';
import { MaintenanceRecord } from './maintenance-record';

function scheduleRecord(): MaintenanceRecord {
  return MaintenanceRecord.schedule({
    type: 'Preventive',
    scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
    scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
  });
}

describe('MaintenanceRecord', () => {
  describe('schedule', () => {
    it('crea el registro en Scheduled', () => {
      const record = scheduleRecord();

      expect(record.status).toBe('Scheduled');
    });

    it('lanza TypeError si scheduledEnd no es posterior a scheduledStart', () => {
      expect(() =>
        MaintenanceRecord.schedule({
          type: 'Preventive',
          scheduledStart: new Date('2026-02-01T17:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T09:00:00.000Z'),
        }),
      ).toThrow(TypeError);
    });
  });

  describe('start', () => {
    it('transiciona Scheduled -> InProgress', () => {
      const record = scheduleRecord();

      record.start();

      expect(record.status).toBe('InProgress');
    });

    it('lanza MaintenanceRecordInvalidStateTransitionError si no esta Scheduled', () => {
      const record = scheduleRecord();
      record.start();

      expect(() => record.start()).toThrow(MaintenanceRecordInvalidStateTransitionError);
    });
  });

  describe('complete', () => {
    it('transiciona InProgress -> Completed y fija fitForService', () => {
      const record = scheduleRecord();
      record.start();

      record.complete(true);

      expect(record.status).toBe('Completed');
      expect(record.fitForService).toBe(true);
    });

    it('docs/model/08-STATE_MACHINES.md SS5.2: Scheduled -> complete() directo es invalida (salta InProgress)', () => {
      const record = scheduleRecord();

      expect(() => record.complete(true)).toThrow(MaintenanceRecordInvalidStateTransitionError);
    });

    it('Completed es terminal - no se puede volver a completar', () => {
      const record = scheduleRecord();
      record.start();
      record.complete(false);

      expect(() => record.complete(true)).toThrow(MaintenanceRecordInvalidStateTransitionError);
    });
  });
});
