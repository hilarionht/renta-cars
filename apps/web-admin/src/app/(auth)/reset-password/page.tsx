'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@frontend/data-access-core';
import { useWebAuth } from '@frontend/data-access-web';
import { Alert, Button, TextField } from '@frontend/ui-kit-web';

import styles from '../auth-layout.module.css';

// Mismas reglas que ResetPasswordRequestDto (#113). El email de recuperacion trae el token en
// crudo (no un link) - gap aceptado en #134: se pega a mano.
const schema = z
  .object({
    token: z.string().min(1, 'Pegá el código que recibiste por email.'),
    newPassword: z.string().min(12, 'Mínimo 12 caracteres.').max(200),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { api } = useWebAuth();
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async ({ token, newPassword }) => {
    setSubmitError(null);
    try {
      await api.request('/api/v1/auth/reset-password', {
        method: 'POST',
        body: { token: token.trim(), newPassword },
        requiresAuth: false,
      });
      setDone(true);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'No se pudo restablecer la contraseña.',
      );
    }
  });

  if (done) {
    return (
      <div className={styles.form}>
        <Alert tone="success">Listo. Ya podés ingresar con tu nueva contraseña.</Alert>
        <p className={styles.footer}>
          <Link href="/login">Ir al login</Link>
        </p>
      </div>
    );
  }

  const errors = form.formState.errors;
  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
      {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
      <TextField
        label="Código del email"
        error={errors.token?.message}
        {...form.register('token')}
      />
      <TextField
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...form.register('newPassword')}
      />
      <TextField
        label="Repetir contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <Button type="submit" fullWidth loading={form.formState.isSubmitting}>
        Cambiar contraseña
      </Button>
      <p className={styles.footer}>
        <Link href="/login">Volver al login</Link>
      </p>
    </form>
  );
}
