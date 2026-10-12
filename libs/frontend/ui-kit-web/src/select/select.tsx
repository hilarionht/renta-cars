import { useId } from 'react';
import type { Ref, SelectHTMLAttributes } from 'react';

import styles from '../field/field.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
}

// React 19: ref es una prop comun (sin forwardRef) - compatible con register() de
// react-hook-form (docs/06-CONVENCIONES-FRONTEND.md SS9).
export function Select({
  label,
  options,
  placeholder,
  error,
  id,
  className,
  ref,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        {...rest}
        ref={ref}
        id={selectId}
        className={[styles.control, error ? styles.invalid : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span id={messageId} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
