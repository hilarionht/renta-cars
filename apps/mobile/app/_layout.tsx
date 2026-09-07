import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@frontend/data-access';
import { LoadingSpinner } from '@frontend/ui-kit-mobile';

// Fase 5 (operador de sucursal, docs/persistence/10-DECISIONES.md #108). QueryClient a
// nivel de modulo (no useState) - una unica instancia por proceso de app, mismo criterio
// que cualquier singleton de cliente HTTP.
const queryClient = new QueryClient();

// Guard de ruta: sin sesion valida, cualquier pantalla fuera de /login redirige ahi.
// useSegments() (no usePathname()) porque expo-router agrupa rutas por segmento de archivo,
// mas estable para esta comparacion que el pathname completo.
//
// segments[0] === 'customer' queda exento (Fase 5 cliente-autogestion, docs/persistence/
// 10-DECISIONES.md #109) - ese subarbol tiene su propio CustomerAuthGuard
// (app/customer/_layout.tsx) con su propia sesion (CustomerAuthProvider, storage/API
// completamente separados de staff) - este guard de staff nunca debe redirigirlo a /login.
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const inLoginScreen = segments[0] === 'login';
    const inCustomerArea = segments[0] === 'customer';
    if (!isAuthenticated && !inLoginScreen && !inCustomerArea) {
      router.replace('/login');
    } else if (isAuthenticated && inLoginScreen) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return <LoadingSpinner testID="auth-loading" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>
          <Stack />
        </AuthGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
