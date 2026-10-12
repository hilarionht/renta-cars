//@ts-check

// docs/09-SEGURIDAD.md §7 / docs/technical/07-SECURITY.md §4: mismas cabeceras que Helmet
// aplica en apps/api (apps/api/src/main.ts) - por defecto en toda ruta, no opt-in por pagina.
// La Content-Security-Policy ya NO vive aca: necesita un nonce por request para los scripts
// inline del App Router, asi que la pone src/proxy.ts (docs/persistence/10-DECISIONES.md
// #134). X-Content-Type-Options explicito porque, a diferencia de Helmet, Next no lo activa
// por default. HSTS con el mismo maxAge que main.ts, a proposito - misma politica, mismo valor.
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
