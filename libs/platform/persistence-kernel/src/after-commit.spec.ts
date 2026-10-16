import {
  deferUntilCommit,
  discardAfterCommit,
  flushAfterCommit,
  openAfterCommitBuffer,
} from './after-commit';

// docs/persistence/10-DECISIONES.md #141: eventos in-process despues del commit.
describe('after-commit', () => {
  it('encola mientras la transaccion esta abierta y emite al confirmar, en orden', () => {
    const tx = {};
    const emitted: string[] = [];
    openAfterCommitBuffer(tx);

    expect(deferUntilCommit(tx, () => emitted.push('a'))).toBe(true);
    expect(deferUntilCommit(tx, () => emitted.push('b'))).toBe(true);
    expect(emitted).toEqual([]);

    flushAfterCommit(tx);
    expect(emitted).toEqual(['a', 'b']);
  });

  it('al revertir descarta lo encolado', () => {
    const tx = {};
    const emitted: string[] = [];
    openAfterCommitBuffer(tx);
    deferUntilCommit(tx, () => emitted.push('a'));

    discardAfterCommit(tx);
    flushAfterCommit(tx);
    expect(emitted).toEqual([]);
  });

  it('una transaccion sin buffer (fuera del UnitOfWork) pide emitir enseguida', () => {
    expect(deferUntilCommit({}, () => undefined)).toBe(false);
  });

  it('un listener que falla no corta a los demas', () => {
    const tx = {};
    const emitted: string[] = [];
    openAfterCommitBuffer(tx);
    deferUntilCommit(tx, () => {
      throw new Error('listener roto');
    });
    deferUntilCommit(tx, () => emitted.push('b'));

    expect(() => flushAfterCommit(tx)).not.toThrow();
    expect(emitted).toEqual(['b']);
  });
});
