/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { proxy } from '../src/proxy';

// docs/persistence/10-DECISIONES.md #134: redirecciones por cookie indicadora + CSP con nonce.
function request(path: string, withSession: boolean) {
  const req = new NextRequest(new URL(path, 'http://localhost:4200'));
  if (withSession) {
    req.cookies.set('renta_session', '1');
  }
  return req;
}

describe('proxy', () => {
  it('sin sesion, una ruta protegida redirige a /login con ?next=', () => {
    const response = proxy(request('/reservations?status=Confirmed', false));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/reservations?status=Confirmed');
  });

  it('sin sesion, / redirige a /login sin next', () => {
    const response = proxy(request('/', false));
    expect(new URL(response.headers.get('location') ?? '').search).toBe('');
  });

  it('las rutas publicas no requieren sesion y reciben CSP', () => {
    const response = proxy(request('/forgot-password', false));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('con sesion, /login redirige al inicio', () => {
    const response = proxy(request('/login', true));
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
  });

  it('con sesion, la CSP lleva un nonce distinto en cada request', () => {
    const first = proxy(request('/', true)).headers.get('content-security-policy') ?? '';
    const second = proxy(request('/', true)).headers.get('content-security-policy') ?? '';
    expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(first).toContain("frame-ancestors 'none'");
    expect(first).not.toEqual(second);
  });
});
