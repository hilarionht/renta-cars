import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useCustomerAuth } from '@frontend/data-access';

import CustomerLoginPhone from '../app/customer/login-phone';

// Espejo de login.spec.tsx - ver ese archivo para el motivo de vivir fuera de app/.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return { ...actual, useCustomerAuth: jest.fn() };
});

describe('CustomerLoginPhone', () => {
  const requestOtp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCustomerAuth as jest.Mock).mockReturnValue({ requestOtp });
  });

  it('valida companyId/phone antes de llamar a requestOtp()', async () => {
    render(<CustomerLoginPhone />);

    fireEvent.press(screen.getByTestId('customer-login-phone-submit'));

    await waitFor(() =>
      expect(screen.getByText('companyId debe ser un UUID valido.')).toBeTruthy(),
    );
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it('con datos validos, llama a requestOtp() y navega a login-otp con companyId/phone', async () => {
    requestOtp.mockResolvedValue(undefined);
    render(<CustomerLoginPhone />);

    fireEvent.changeText(
      screen.getByTestId('customer-login-company-id'),
      '11111111-1111-1111-1111-111111111111',
    );
    fireEvent.changeText(screen.getByTestId('customer-login-phone'), '+525512345678');
    fireEvent.press(screen.getByTestId('customer-login-phone-submit'));

    await waitFor(() =>
      expect(requestOtp).toHaveBeenCalledWith({
        companyId: '11111111-1111-1111-1111-111111111111',
        phone: '+525512345678',
      }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/customer/login-otp',
        params: {
          companyId: '11111111-1111-1111-1111-111111111111',
          phone: '+525512345678',
        },
      }),
    );
  });

  it('si requestOtp() falla con ApiError, muestra su mensaje sin navegar', async () => {
    requestOtp.mockRejectedValue(new ApiError(429, 'Demasiados intentos'));
    render(<CustomerLoginPhone />);

    fireEvent.changeText(
      screen.getByTestId('customer-login-company-id'),
      '11111111-1111-1111-1111-111111111111',
    );
    fireEvent.changeText(screen.getByTestId('customer-login-phone'), '+525512345678');
    fireEvent.press(screen.getByTestId('customer-login-phone-submit'));

    await waitFor(() => expect(screen.getByText('Demasiados intentos')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });
});
