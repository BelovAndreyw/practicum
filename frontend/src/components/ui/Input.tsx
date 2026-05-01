import { InputHTMLAttributes, ReactNode, useId } from 'react';
import styles from './Input.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
}

export function Input({ label, error, hint, prefix, className = '', id: externalId, ...rest }: Props) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className={styles.wrapper}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <div className={[styles.inputWrap, error ? styles.hasError : ''].join(' ')}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input id={id} className={[styles.input, className].join(' ')} {...rest} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
