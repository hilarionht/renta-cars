'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

import styles from '../field/field.module.css';

// docs/persistence/10-DECISIONES.md #140: casilla con su etiqueta, para la matriz de permisos y la
// eleccion de roles. Nativa (teclado y lector de pantalla gratis); hint opcional debajo.
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({ label, hint, id, className, ref, ...rest }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  return (
    <div className={[styles.checkboxField, className].filter(Boolean).join(' ')}>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type="checkbox"
        className={styles.checkboxControl}
        aria-describedby={hint ? hintId : undefined}
      />
      <label className={styles.checkboxLabel} htmlFor={inputId}>
        {label}
        {hint ? (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}
