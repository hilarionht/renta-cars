'use client';

import type { FormEvent, ReactNode } from 'react';

import { Alert, Button, Dialog } from '@frontend/ui-kit-web';

import styles from './admin-page.module.css';

// Dialogo con formulario compartido por las acciones de los modulos (Reservas #135, Flota #137):
// Cancelar, acciones extra opcionales y el boton de enviar, que apunta al <form> por id.
export function FormDialog({
  title,
  onClose,
  onSubmit,
  error,
  pending,
  submitLabel,
  submitDisabled,
  children,
  extraActions,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  children: ReactNode;
  extraActions?: ReactNode;
}) {
  const formId = `form-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          {extraActions}
          <Button type="submit" form={formId} loading={pending} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Dialog>
  );
}
