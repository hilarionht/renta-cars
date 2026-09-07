import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

import { FailOpenThrottlerGuard } from './fail-open-throttler.guard';

function buildGuard(): FailOpenThrottlerGuard {
  // ThrottlerGuard.constructor solo asigna options/storageService/reflector, sin validar -
  // no hace falta simularlos de verdad para probar handleRequest() en aislamiento.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new FailOpenThrottlerGuard({} as any, {} as any, {} as any);
}

describe('FailOpenThrottlerGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devuelve el resultado normal de ThrottlerGuard cuando no hay error', async () => {
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(ThrottlerGuard.prototype, 'handleRequest' as any)
      .mockResolvedValue(true);
    const guard = buildGuard();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (guard as any).handleRequest({});

    expect(result).toBe(true);
  });

  it('propaga ThrottlerException (limite realmente superado) sin fail-open', async () => {
    const error = new ThrottlerException();
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(ThrottlerGuard.prototype, 'handleRequest' as any)
      .mockRejectedValue(error);
    const guard = buildGuard();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((guard as any).handleRequest({})).rejects.toThrow(ThrottlerException);
  });

  it('fail-open (retorna true) si Redis falla con cualquier otro error', async () => {
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(ThrottlerGuard.prototype, 'handleRequest' as any)
      .mockRejectedValue(new Error('ECONNREFUSED'));
    const guard = buildGuard();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (guard as any).handleRequest({});

    expect(result).toBe(true);
  });
});
