import { StorageRef } from './storage-ref';

describe('StorageRef', () => {
  it('from() acepta un string no vacio y hace trim', () => {
    expect(StorageRef.from('  company-a/uuid-1  ').toString()).toBe('company-a/uuid-1');
  });

  it('from() rechaza un string vacio o solo espacios', () => {
    expect(() => StorageRef.from('')).toThrow(TypeError);
    expect(() => StorageRef.from('   ')).toThrow(TypeError);
  });
});
