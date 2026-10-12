//@ts-check

// docs/09-SEGURIDAD.md §7 / docs/technical/07-SECURITY.md §4: mismas cabeceras que Helmet
// aplica en apps/api (apps/api/src/main.ts) - por defecto en toda ruta, no opt-in por
// pagina. connect-src suma NEXT_PUBLIC_API_URL ademas de 'self' - el unico fetch de hoy
// (login/page.tsx) corre server-side (sin CORS), pero un fetch client-side real (cuando
// exista @frontend/data-access) va a necesitar llegar a la API desde el navegador.
// X-Content-Type-Options explicito porque, a diferencia de Helmet, Next no lo activa por
// default. HSTS con el mismo maxAge que main.ts, a proposito - misma politica, mismo valor.
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? '';
    const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self'",
              "img-src 'self' data:",
              "object-src 'none'",
              "frame-ancestors 'none'",
              `connect-src ${connectSrc}`,
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=15552000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
