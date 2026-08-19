import { DamageReport } from './damage-report';

describe('DamageReport', () => {
  it('register() crea un damage report con id propio', () => {
    const damageReport = DamageReport.register({
      inspectionId: 'inspection-1',
      description: 'rayón puerta trasera',
      severity: 'Minor',
      imputableToCustomer: true,
      photoFileIds: ['file-1'],
    });

    expect(damageReport.inspectionId).toBe('inspection-1');
    expect(damageReport.severity).toBe('Minor');
    expect(damageReport.imputableToCustomer).toBe(true);
    expect(damageReport.photoFileIds).toEqual(['file-1']);
    expect(damageReport.id).toBeDefined();
  });
});
