import { createElement as mockCreateElement, type ReactNode } from 'react';
import { Text as mockText } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { router, useSegments } from 'expo-router';

import { useCustomerAuth } from '@frontend/data-access';

import CustomerLayout from '../app/customer/_layout';

// Espejo de root-layout.spec.tsx - ver ese archivo para el motivo del passthrough de Stack
// y el prefijo mock* de las referencias externas dentro de la factory de jest.mock().
jest.mock('expo-router', () => ({
  Stack: () => mockCreateElement(mockText, { testID: 'stack' }, 'stack'),
  router: { replace: jest.fn() },
  useSegments: jest.fn(),
}));
jest.mock('@frontend/data-access', () => ({
  CustomerAuthProvider: ({ children }: { children: ReactNode }) => children,
  useCustomerAuth: jest.fn(),
}));

describe('CustomerLayout / CustomerAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra el spinner de carga mientras isLoading', () => {
    (useCustomerAuth as jest.Mock).mockReturnValue({ isLoading: true, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue(['customer']);

    render(<CustomerLayout />);

    expect(screen.getByTestId('customer-auth-loading')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sin sesion y fuera de login-phone/login-otp, redirige a /customer/login-phone', async () => {
    (useCustomerAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue(['customer']);

    render(<CustomerLayout />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/customer/login-phone'));
  });

  it('sin sesion y ya en login-phone, no redirige', () => {
    (useCustomerAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
    (useSegments as jest.Mock).mockReturnValue(['customer', 'login-phone']);

    render(<CustomerLayout />);

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('con sesion y en login-otp, redirige a /customer', async () => {
    (useCustomerAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: true });
    (useSegments as jest.Mock).mockReturnValue(['customer', 'login-otp']);

    render(<CustomerLayout />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/customer'));
  });

  it('con sesion fuera de las pantallas de login, renderiza el Stack sin redirigir', () => {
    (useCustomerAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: true });
    (useSegments as jest.Mock).mockReturnValue(['customer']);

    render(<CustomerLayout />);

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
