import { createElement as mockCreateElement, type ReactNode } from 'react';
import { Text as mockText } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { router, useSegments } from 'expo-router';

import { useAuth } from '@frontend/data-access';

import RootLayout from '../app/_layout';

// Vive fuera de app/ - mismo motivo que specs/login.spec.tsx. Stack real de expo-router
// necesita un NavigationContainer completo para renderizar - se reemplaza por un
// passthrough con testID fijo, suficiente para probar el guard de AuthGuard sin testear el
// router en si. mockCreateElement/mockText: nombres prefijados "mock" a proposito - unica
// forma en que Jest permite referenciar imports del scope externo dentro de una factory de
// jest.mock() (hoisting).
jest.mock('expo-router', () => ({
  Stack: () => mockCreateElement(mockText, { testID: 'stack' }, 'stack'),
  router: { replace: jest.fn() },
  useSegments: jest.fn(),
}));
jest.mock('@frontend/data-access', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: jest.fn(),
}));

describe('RootLayout / AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra el spinner de carga mientras isLoading', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: true, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue([]);

    render(<RootLayout />);

    expect(screen.getByTestId('auth-loading')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sin sesion y fuera de /login, redirige a /login', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue([]);

    render(<RootLayout />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('sin sesion y ya en /login, no redirige', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue(['login']);

    render(<RootLayout />);

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('con sesion y en /login, redirige a home', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: true });
    (useSegments as jest.Mock).mockReturnValue(['login']);

    render(<RootLayout />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('con sesion fuera de /login, renderiza el Stack sin redirigir', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: true });
    (useSegments as jest.Mock).mockReturnValue([]);

    render(<RootLayout />);

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  // Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - el AuthGuard de
  // staff nunca debe redirigir el subarbol /customer/*, que tiene su propio
  // CustomerAuthGuard (apps/mobile/app/customer/_layout.tsx).
  it('sin sesion de staff pero en el subarbol /customer, no redirige a /login', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue(['customer', 'login-phone']);

    render(<RootLayout />);

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
