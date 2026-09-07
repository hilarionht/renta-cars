// Feature "customer/login-phone" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5
// cliente-autogestion (docs/persistence/10-DECISIONES.md #109). Paso 1 de 2 del login OTP -
// pide companyId+phone, dispara el envio del codigo por WhatsApp, pasa ambos campos a
// login-otp.tsx via params (no hay concepto de "sesion de OTP pendiente" del lado servidor,
// verify vuelve a pedirlos).
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, StyleSheet } from 'react-native';
import { z } from 'zod';

import { ApiError, useCustomerAuth } from '@frontend/data-access';
import { Button, Screen, TextField } from '@frontend/ui-kit-mobile';

const loginPhoneSchema = z.object({
  companyId: z.string().uuid('companyId debe ser un UUID valido.'),
  phone: z.string().min(1, 'Ingresa tu numero de telefono.'),
});

type LoginPhoneFormValues = z.infer<typeof loginPhoneSchema>;

export default function CustomerLoginPhone() {
  const { requestOtp } = useCustomerAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginPhoneFormValues>({
    resolver: zodResolver(loginPhoneSchema),
    defaultValues: { companyId: '', phone: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await requestOtp(values);
      router.push({
        pathname: '/customer/login-otp',
        params: { companyId: values.companyId, phone: values.phone },
      });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo enviar el codigo. Intenta de nuevo.',
      );
    }
  });

  return (
    <Screen scrollable testID="customer-login-phone-screen">
      <Text role="heading" style={styles.heading}>
        Ingresar como cliente
      </Text>

      <Controller
        control={control}
        name="companyId"
        render={({ field }) => (
          <TextField
            label="ID de compañía"
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.companyId?.message}
            testID="customer-login-company-id"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            label="Teléfono (ej. +525512345678)"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="phone-pad"
            errorMessage={errors.phone?.message}
            testID="customer-login-phone"
          />
        )}
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Enviar código"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="customer-login-phone-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  // #D92D20 = colors.danger de ui-kit-core, mismo literal documentado que login/index.tsx.
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
