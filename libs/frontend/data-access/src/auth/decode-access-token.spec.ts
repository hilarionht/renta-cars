import { decodeAccessToken } from './decode-access-token';

// Helper de test unicamente - Buffer esta disponible en el proceso Node de Jest, el modulo
// bajo test deliberadamente no lo usa (ver comentario en decode-access-token.ts).
function buildFakeAccessToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('decodeAccessToken', () => {
  it('decodifica sub/companyId/roles del payload', () => {
    const token = buildFakeAccessToken({
      sub: 'user-1',
      companyId: 'company-1',
      roles: ['role-1'],
    });

    const claims = decodeAccessToken(token);

    expect(claims).toEqual({ sub: 'user-1', companyId: 'company-1', roles: ['role-1'] });
  });

  it('decodifica branchId opcional cuando esta presente', () => {
    const token = buildFakeAccessToken({
      sub: 'user-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      roles: [],
    });

    const claims = decodeAccessToken(token);

    expect(claims.branchId).toBe('branch-1');
  });

  it('soporta caracteres UTF-8 en el payload (acentos)', () => {
    const token = buildFakeAccessToken({
      sub: 'user-ñ',
      companyId: 'company-1',
      roles: ['Administración'],
    });

    const claims = decodeAccessToken(token);

    expect(claims.sub).toBe('user-ñ');
    expect(claims.roles).toEqual(['Administración']);
  });

  it('tira error si falta el segmento de payload', () => {
    expect(() => decodeAccessToken('solo-header')).toThrow('accessToken invalido');
  });
});
