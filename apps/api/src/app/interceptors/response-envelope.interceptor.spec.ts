import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

function buildCallHandler(result: unknown): CallHandler {
  return { handle: () => of(result) };
}

async function intercept(result: unknown): Promise<unknown> {
  const interceptor = new ResponseEnvelopeInterceptor();
  const observable = interceptor.intercept({} as ExecutionContext, buildCallHandler(result));
  return new Promise((resolve) => {
    observable.subscribe((value) => resolve(value));
  });
}

describe('ResponseEnvelopeInterceptor', () => {
  it('envuelve un valor plano como data, con meta base {generatedAt, apiVersion}', async () => {
    const result = await intercept({ id: '1' });

    expect(result).toEqual({
      data: { id: '1' },
      meta: { generatedAt: expect.any(String), apiVersion: 'v1' },
    });
  });

  it('preserva el shape {data, warnings} ya existente', async () => {
    const result = await intercept({ data: { id: '1' }, warnings: ['w1'] });

    expect(result).toEqual({
      data: { id: '1' },
      meta: { generatedAt: expect.any(String), apiVersion: 'v1' },
      warnings: ['w1'],
    });
  });

  it('mergea un {data, meta} provisto por el controller sobre la meta base', async () => {
    const result = await intercept({ data: [1, 2], meta: { nextCursor: 'abc', limit: 25 } });

    expect(result).toEqual({
      data: [1, 2],
      meta: {
        nextCursor: 'abc',
        limit: 25,
        generatedAt: expect.any(String),
        apiVersion: 'v1',
      },
    });
  });

  it('la meta base gana si colisiona una clave con la meta del controller', async () => {
    const result = await intercept({ data: [1], meta: { apiVersion: 'v99' } });

    expect((result as { meta: { apiVersion: string } }).meta.apiVersion).toBe('v1');
  });
});
