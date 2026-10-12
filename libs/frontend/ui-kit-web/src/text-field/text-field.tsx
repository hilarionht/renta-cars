'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

import styles from '../field/field.module.css';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

// React 19: ref es una prop comun (sin forwardRef) - compatible con register() de
// react-hook-form (docs/06-CONVENCIONES-FRONTEND.md SS9).
export function TextField({ label, error, hint, id, className, ref, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        className={[styles.control, error ? styles.invalid : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
      />
      {error ? (
        <span id={messageId} className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
