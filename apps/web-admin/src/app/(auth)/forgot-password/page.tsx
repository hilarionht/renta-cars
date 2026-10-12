'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useWebAuth } from '@frontend/data-access-web';
import { Alert, Button, TextField } from '@frontend/ui-kit-web';

import styles from '../auth-layout.module.css';

// Mismas reglas que ForgotPasswordRequestDto (#113). El API responde igual exista o no el
// email (anti-enumeracion), asi que la pantalla siempre muestra el mismo mensaje.
const schema = z.object({
  companyId: z.string().uuid('El ID de compañía debe ser un UUID válido.'),
  email: z.string().email('Email inválido.'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { api } = useWebAuth();
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { companyId: process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID ?? '', email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await api.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: values,
        requiresAuth: false,
      });
      setSent(true);
    } catch {
      setSubmitError('No se pudo enviar el pedido. Intentá de nuevo.');
    }
  });

  if (sent) {
    return (
      <div className={styles.form}>
        <Alert tone="success">
          Si el email existe, te enviamos un código para restablecer la contraseña.
        </Alert>
        <p className={styles.footer}>
          <Link href="/reset-password">Ya tengo el código</Link>
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
      {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
      <TextField
        label="ID de compañía"
        error={form.formState.errors.companyId?.message}
        {...form.register('companyId')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="username"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Button type="submit" fullWidth loading={form.formState.isSubmitting}>
        Enviar código
      </Button>
      <p className={styles.footer}>
        <Link href="/login">Volver al login</Link>
      </p>
    </form>
  );
}
