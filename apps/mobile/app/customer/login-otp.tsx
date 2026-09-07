// Feature "customer/login-otp" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5
// cliente-autogestion (docs/persistence/10-DECISIONES.md #109). Paso 2 de 2 - companyId/
// phone llegan por params desde login-phone.tsx. Mensaje de error SIEMPRE generico: el
// backend nunca distingue codigo-incorrecto de challenge-expirado ni de telefono-inexistente
// (mismo codigo OTP_CHALLENGE_NOT_FOUND/OTP_CODE_INVALID, decision #109) - distinguirlos aca
// seria una superficie de enumeracion que el backend deliberadamente no expone. "Reenviar
// código" lleva cooldown en el cliente porque otp/request y otp/verify comparten el mismo
// AUTH_THROTTLE_PROFILE del backend - reenviar sin limite puede agotar el balde y bloquear
// tambien el verify.
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, StyleSheet } from 'react-native';
import { z } from 'zod';

import { ApiError, useCustomerAuth } from '@frontend/data-access';
import { Button, Screen, TextField } from '@frontend/ui-kit-mobile';

const RESEND_COOLDOWN_SECONDS = 30;

const otpSchema = z.object({
  code: z.string().length(6, 'El código tiene 6 dígitos.'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

export default function CustomerLoginOtp() {
  const { companyId, phone } = useLocalSearchParams<{ companyId: string; phone: string }>();
  const { verifyOtp, requestOtp } = useCustomerAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await verifyOtp({ companyId, phone, code: values.code });
    } catch {
      // Generico a proposito - ver comentario de arriba del archivo.
      setSubmitError('Código inválido o expirado. Pedí uno nuevo.');
    }
  });

  const onResend = async () => {
    setSubmitError(null);
    setIsResending(true);
    try {
      await requestOtp({ companyId, phone });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'No se pudo reenviar el código.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Screen scrollable testID="customer-login-otp-screen">
      <Text role="heading" style={styles.heading}>
        Ingresá el código
      </Text>
      <Text style={styles.subheading}>Te lo enviamos por WhatsApp al {phone}.</Text>

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Código de 6 dígitos"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="number-pad"
            errorMessage={errors.code?.message}
            testID="customer-login-otp-code"
          />
        )}
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Confirmar"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="customer-login-otp-submit"
      />
      <Button
        label={resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
        onPress={() => void onResend()}
        disabled={resendCooldown > 0}
        loading={isResending}
        testID="customer-login-otp-resend"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  subheading: {
    marginBottom: 16,
    color: '#6B6B6B',
  },
  // #D92D20 = colors.danger de ui-kit-core, mismo literal documentado que login/index.tsx.
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
