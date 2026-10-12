import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import '@frontend/ui-kit-web/styles/tokens.css';
import '@frontend/ui-kit-web/styles/base.css';

import { Providers } from './providers';

export const metadata = {
  title: 'Renta - Administración',
  description: 'Panel de administración de Renta.',
};

// Leer headers() vuelve dinamica toda la app: el nonce de la CSP (src/proxy.ts) es distinto
// en cada request y Next solo lo aplica a sus scripts inline en render dinamico
// (docs/persistence/10-DECISIONES.md #134). En una app autenticada no se pierde nada estatico.
export default async function RootLayout({ children }: { children: ReactNode }) {
  await headers();
  return (
    <html lang="es">
      <body>
        <Providers apiBaseUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}>{children}</Providers>
      </body>
    </html>
  );
}
