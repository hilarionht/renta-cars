import { ActorRef } from './actor-ref';

describe('ActorRef', () => {
  it('from() acepta un string no vacio y hace trim', () => {
    expect(ActorRef.from('  user-123  ').toString()).toBe('user-123');
  });

  it('from() rechaza un string vacio o solo espacios', () => {
    expect(() => ActorRef.from('')).toThrow(TypeError);
    expect(() => ActorRef.from('   ')).toThrow(TypeError);
  });

  it('system() produce el literal "system"', () => {
    expect(ActorRef.system().toString()).toBe('system');
  });
});
