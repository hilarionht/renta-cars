import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { CustomerAuthProvider, useCustomerAuth } from '@frontend/data-access';
import { LoadingSpinner } from '@frontend/ui-kit-mobile';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - espejo del
// AuthGuard raiz (apps/mobile/app/_layout.tsx), acotado a este subarbol. useSegments()
// siempre devuelve la ruta completa desde la raiz (['customer', ...]) aunque este guard
// viva en un _layout anidado - por eso compara segments[1], no segments[0].
function CustomerAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useCustomerAuth();
  // Cast a string[] - expo-router tipa el tuple de useSegments() por la ruta ESTATICA de
  // este archivo (['customer']), mas angosto que lo que realmente devuelve en runtime
  // (siempre el path completo desde la raiz, confirmado en el AuthGuard raiz).
  const segments = useSegments() as string[];

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const inLoginScreen = segments[1] === 'login-phone' || segments[1] === 'login-otp';
    if (!isAuthenticated && !inLoginScreen) {
      router.replace('/customer/login-phone');
    } else if (isAuthenticated && inLoginScreen) {
      router.replace('/customer');
    }
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return <LoadingSpinner testID="customer-auth-loading" />;
  }

  return <>{children}</>;
}

export default function CustomerLayout() {
  return (
    <CustomerAuthProvider>
      <CustomerAuthGuard>
        <Stack />
      </CustomerAuthGuard>
    </CustomerAuthProvider>
  );
}
