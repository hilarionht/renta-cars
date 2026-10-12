'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { WebAuthProvider } from '@frontend/data-access-web';

// Estado de servidor con React Query y sesion del personal (docs/06-CONVENCIONES-FRONTEND.md
// SS5, docs/persistence/10-DECISIONES.md #134). Un QueryClient por montaje de la app (no un
// singleton de modulo) para no compartir cache entre requests en el render del servidor.
export function Providers({ apiBaseUrl, children }: { apiBaseUrl: string; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <WebAuthProvider baseUrl={apiBaseUrl}>{children}</WebAuthProvider>
    </QueryClientProvider>
  );
}
