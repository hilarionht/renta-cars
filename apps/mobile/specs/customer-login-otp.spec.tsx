import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { useCustomerAuth } from '@frontend/data-access';

import CustomerLoginOtp from '../app/customer/login-otp';

// Espejo de login.spec.tsx (motivo de vivir fuera de app/) + useLocalSearchParams mockeado
// (companyId/phone llegan por params desde login-phone.tsx).
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return { ...actual, useCustomerAuth: jest.fn() };
});

describe('CustomerLoginOtp', () => {
  const verifyOtp = jest.fn();
  const requestOtp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      companyId: '11111111-1111-1111-1111-111111111111',
      phone: '+525512345678',
    });
    (useCustomerAuth as jest.Mock).mockReturnValue({ verifyOtp, requestOtp });
  });

  it('con un codigo valido, llama a verifyOtp() con companyId/phone/code', async () => {
    verifyOtp.mockResolvedValue(undefined);
    render(<CustomerLoginOtp />);

    fireEvent.changeText(screen.getByTestId('customer-login-otp-code'), '123456');
    fireEvent.press(screen.getByTestId('customer-login-otp-submit'));

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        companyId: '11111111-1111-1111-1111-111111111111',
        phone: '+525512345678',
        code: '123456',
      }),
    );
  });

  // El backend nunca distingue codigo-incorrecto de challenge-expirado (decision #109) - el
  // mensaje mostrado es SIEMPRE el mismo generico, sin importar el error real.
  it('si verifyOtp() falla, muestra el mensaje generico (nunca distingue la causa)', async () => {
    verifyOtp.mockRejectedValue(new Error('OTP_CODE_INVALID'));
    render(<CustomerLoginOtp />);

    fireEvent.changeText(screen.getByTestId('customer-login-otp-code'), '000000');
    fireEvent.press(screen.getByTestId('customer-login-otp-submit'));

    await waitFor(() =>
      expect(screen.getByText('Código inválido o expirado. Pedí uno nuevo.')).toBeTruthy(),
    );
  });

  it('el boton de reenviar arranca deshabilitado por el cooldown', () => {
    render(<CustomerLoginOtp />);

    const resendButton = screen.getByTestId('customer-login-otp-resend');
    const props = resendButton.props as { accessibilityState?: { disabled?: boolean } };
    expect(props.accessibilityState?.disabled).toBe(true);
  });
});
