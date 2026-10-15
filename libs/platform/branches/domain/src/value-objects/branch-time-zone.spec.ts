import { InvalidValueError } from '@platform/shared-kernel';

import { BranchTimeZone, DEFAULT_BRANCH_TIME_ZONE } from './branch-time-zone';

// docs/persistence/10-DECISIONES.md #135.
describe('BranchTimeZone', () => {
  it('acepta una zona IANA valida', () => {
    expect(BranchTimeZone.from('America/Mexico_City').toString()).toBe('America/Mexico_City');
  });

  it('guarda el nombre tal como viene (sin espacios), no el alias canonico de ICU', () => {
    expect(BranchTimeZone.from('  America/Argentina/Buenos_Aires ').toString()).toBe(
      'America/Argentina/Buenos_Aires',
    );
  });

  it('rechaza una zona inexistente', () => {
    expect(() => BranchTimeZone.from('Mars/Olympus_Mons')).toThrow(InvalidValueError);
  });

  it('rechaza un valor vacio', () => {
    expect(() => BranchTimeZone.from('   ')).toThrow(InvalidValueError);
  });

  it('default() es Buenos Aires', () => {
    expect(BranchTimeZone.default().toString()).toBe(DEFAULT_BRANCH_TIME_ZONE);
  });
});
