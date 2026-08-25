import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useAuth } from '@frontend/data-access';

import Login from '../app/login/index';

// Vive fuera de app/ para que Expo Router no lo trate como una ruta (docs/06-CONVENCIONES-
// FRONTEND.md SS4) - mismo patron que apps/mobile/specs/index.spec.tsx.
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
// Solo useAuth() se mockea - ApiError se deja pasar tal cual (jest.requireActual tipado
// explicito, evita que el spread implicito quede en `any`).
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return { ...actual, useAuth: jest.fn() };
});

describe('Login', () => {
  const login = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ login });
  });

  it('valida companyId/email/password antes de llamar a login()', async () => {
    render(<Login />);

    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() =>
      expect(screen.getByText('companyId debe ser un UUID valido.')).toBeTruthy(),
    );
    expect(login).not.toHaveBeenCalled();
  });

  it('con datos validos, llama a login() y navega a home', async () => {
    login.mockResolvedValue(undefined);
    render(<Login />);

    fireEvent.changeText(
      screen.getByTestId('login-company-id'),
      '11111111-1111-1111-1111-111111111111',
    );
    fireEvent.changeText(screen.getByTestId('login-email'), 'operador@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'password123');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        companyId: '11111111-1111-1111-1111-111111111111',
        email: 'operador@example.com',
        password: 'password123',
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('si login() falla con ApiError, muestra su mensaje sin navegar', async () => {
    login.mockRejectedValue(new ApiError(401, 'Credenciales invalidas'));
    render(<Login />);

    fireEvent.changeText(
      screen.getByTestId('login-company-id'),
      '11111111-1111-1111-1111-111111111111',
    );
    fireEvent.changeText(screen.getByTestId('login-email'), 'operador@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'password123');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByText('Credenciales invalidas')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
