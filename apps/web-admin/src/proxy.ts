import { NextResponse, type NextRequest } from 'next/server';

// Proxy de Next 16 (antes "middleware"). docs/persistence/10-DECISIONES.md #134:
//   1. Content-Security-Policy con un nonce nuevo por request: los scripts inline del App
//      Router lo llevan; sin nonce, una CSP estatica ('self') los bloquea.
//   2. Redireccion de rutas protegidas segun la cookie INDICADORA renta_session (no contiene
//      secretos; la pone el cliente al iniciar sesion). La cookie refresh_token es httpOnly y
//      pertenece al origen del API, este proxy no la puede ver. La autorizacion real la hace
//      siempre el API en cada request - esto es solo navegacion.

const SESSION_INDICATOR_COOKIE = 'renta_session';
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? '';
  // docs/persistence/10-DECISIONES.md #137: la subida de archivos hace un PUT directo a la URL
  // firmada del almacenamiento S3. Tiene que ser EXACTAMENTE el origen de STORAGE_ENDPOINT del
  // API (la URL se firma con ese host; localhost y 127.0.0.1 no son intercambiables).
  const storageOrigin = process.env.NEXT_PUBLIC_STORAGE_ORIGIN ?? '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // En desarrollo el bundler inyecta <style> sin nonce; en produccion solo con nonce.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${["'self'", apiOrigin, storageOrigin].filter(Boolean).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_INDICATOR_COOKIE)?.value === '1';

  if (!hasSession && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
