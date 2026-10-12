'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@frontend/data-access-core';
import { useWebAuth } from '@frontend/data-access-web';
import { Alert, Button, TextField } from '@frontend/ui-kit-web';

import styles from '../auth-layout.module.css';

// Mismas reglas que LoginRequestDto / MfaVerifyRequestDto del API (docs/06 SS9).
const loginSchema = z.object({
  companyId: z.string().uuid('El ID de compañía debe ser un UUID válido.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.').max(200),
});
type LoginValues = z.infer<typeof loginSchema>;

const mfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
});
type MfaValues = z.infer<typeof mfaSchema>;

// Solo rutas internas: evita un open redirect via ?next=https://otro-sitio.
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Credenciales inválidas.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Esperá un minuto y volvé a probar.';
    }
    return error.message;
  }
  return 'No se pudo conectar con el servidor.';
}

export function LoginForm() {
  const { login, verifyMfa } = useWebAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<{ companyId: string; mfaChallengeId: string } | null>(null);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      companyId: process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID ?? '',
      email: '',
      password: '',
    },
  });
  const mfaForm = useForm<MfaValues>({ resolver: zodResolver(mfaSchema) });

  const goNext = () => router.replace(safeNext(searchParams.get('next')));

  const onLogin = loginForm.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await login(values);
      if (result.mfaRequired) {
        setMfa({ companyId: values.companyId, mfaChallengeId: result.mfaChallengeId });
        return;
      }
      goNext();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  const onVerifyMfa = mfaForm.handleSubmit(async (values) => {
    if (!mfa) {
      return;
    }
    setSubmitError(null);
    try {
      await verifyMfa({ ...mfa, code: values.code });
      goNext();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  if (mfa) {
    return (
      <form className={styles.form} onSubmit={(event) => void onVerifyMfa(event)} noValidate>
        <Alert tone="info">Ingresá el código de 6 dígitos de tu app autenticadora.</Alert>
        {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
        <TextField
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          error={mfaForm.formState.errors.code?.message}
          {...mfaForm.register('code')}
        />
        <Button type="submit" fullWidth loading={mfaForm.formState.isSubmitting}>
          Verificar
        </Button>
        <Button variant="ghost" fullWidth onClick={() => setMfa(null)}>
          Volver
        </Button>
      </form>
    );
  }

  const errors = loginForm.formState.errors;
  return (
    <form className={styles.form} onSubmit={(event) => void onLogin(event)} noValidate>
      {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
      <TextField
        label="ID de compañía"
        autoComplete="organization"
        error={errors.companyId?.message}
        {...loginForm.register('companyId')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...loginForm.register('email')}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...loginForm.register('password')}
      />
      <Button type="submit" fullWidth loading={loginForm.formState.isSubmitting}>
        Ingresar
      </Button>
      <p className={styles.footer}>
        <Link href="/forgot-password">Olvidé mi contraseña</Link>
      </p>
    </form>
  );
}
