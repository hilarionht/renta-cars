'use client';

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import styles from '../field/field.module.css';

// docs/persistence/10-DECISIONES.md #137. Selector de archivo con el mismo label/error/hint que
// TextField. Solo elige el archivo: subirlo (URL firmada, PUT, confirmacion) es de data-access.
export interface FileInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value'
> {
  label: string;
  error?: string;
  hint?: string;
  onFileChange: (file: File | null) => void;
}

export function FileInput({
  label,
  error,
  hint,
  id,
  className,
  onFileChange,
  ...rest
}: FileInputProps) {
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
        type="file"
        id={inputId}
        className={[styles.file, error ? styles.invalid : '', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
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
