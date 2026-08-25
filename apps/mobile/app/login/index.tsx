// Feature "login" de "mobile" - docs/06-CONVENCIONES-FRONTEND.md SS2.
// Regla de dependencia: esta feature -> @frontend/data-access + ui-kit -> @frontend/domain-types.
// Nunca al reves, y nunca importa '@frontend/ui-kit-core' directamente (solo la variante de plataforma).
//
// Fase 5 (operador de sucursal, docs/persistence/10-DECISIONES.md #108) - primera pantalla
// real, reemplaza el placeholder de health-check del bootstrap. react-hook-form + zod
// (docs/06-CONVENCIONES-FRONTEND.md SS9), schema espeja LoginRequest 1:1.
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, StyleSheet } from 'react-native';
import { z } from 'zod';

import { ApiError, useAuth } from '@frontend/data-access';
import { Button, Screen, TextField } from '@frontend/ui-kit-mobile';

const loginSchema = z.object({
  companyId: z.string().uuid('companyId debe ser un UUID valido.'),
  email: z.string().email('Ingresa un email valido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { companyId: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      router.replace('/');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'No se pudo iniciar sesion. Intenta de nuevo.',
      );
    }
  });

  return (
    <Screen scrollable testID="login-screen">
      <Text role="heading" style={styles.heading}>
        Iniciar sesión
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
            testID="login-company-id"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="email-address"
            errorMessage={errors.email?.message}
            testID="login-email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Contraseña"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            errorMessage={errors.password?.message}
            testID="login-password"
          />
        )}
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Ingresar"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="login-submit"
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
  // #D92D20 = colors.danger de ui-kit-core (literal, no importado directo - esta capa solo
  // puede pasar por ui-kit-mobile, que no re-exporta tokens crudos).
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
