import { createRefreshCoordinator } from './refresh-coordinator';

// docs/persistence/10-DECISIONES.md #134: reusar un refresh ya rotado revoca TODAS las sesiones
// del usuario en el API - el coordinador nunca debe dejar salir dos refresh concurrentes.
describe('createRefreshCoordinator', () => {
  const originalLocks = (navigator as Navigator & { locks?: unknown }).locks;

  afterEach(() => {
    Object.defineProperty(navigator, 'locks', { value: originalLocks, configurable: true });
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('llamadas concurrentes comparten un unico refresh (single-flight)', async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    const pending = deferred<string>();
    const doRefresh = jest.fn(() => pending.promise);
    const refresh = createRefreshCoordinator(doRefresh);

    const calls = [refresh(), refresh(), refresh()];
    pending.resolve('token-nuevo');

    await expect(Promise.all(calls)).resolves.toEqual([
      'token-nuevo',
      'token-nuevo',
      'token-nuevo',
    ]);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });

  it('una vez resuelto, el siguiente pedido hace un refresh nuevo', async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    const doRefresh = jest.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    const refresh = createRefreshCoordinator(doRefresh);

    await expect(refresh()).resolves.toBe('token-1');
    await expect(refresh()).resolves.toBe('token-2');
    expect(doRefresh).toHaveBeenCalledTimes(2);
  });

  it('si el refresh falla, propaga el error y libera para reintentar', async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    const doRefresh = jest
      .fn()
      .mockRejectedValueOnce(new Error('cookie invalida'))
      .mockResolvedValueOnce('token-ok');
    const refresh = createRefreshCoordinator(doRefresh);

    await expect(refresh()).rejects.toThrow('cookie invalida');
    await expect(refresh()).resolves.toBe('token-ok');
  });

  it('con Web Locks disponible, serializa entre pestanas bajo el lock renta-refresh', async () => {
    const request = jest.fn((_name: string, callback: () => Promise<string>) => callback());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    const doRefresh = jest.fn(() => Promise.resolve('token-lock'));
    const refresh = createRefreshCoordinator(doRefresh);

    await expect(Promise.all([refresh(), refresh()])).resolves.toEqual([
      'token-lock',
      'token-lock',
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('renta-refresh');
  });
});
