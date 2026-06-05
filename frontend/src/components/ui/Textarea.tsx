import { TextareaHTMLAttributes, useId } from 'react';
import styles from './Textarea.module.css';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, id: externalId, className = '', ...rest }: Props) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className={styles.wrapper}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <textarea
        id={id}
        className={[styles.textarea, error ? styles.hasError : '', className].join(' ')}
        {...rest}
      />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
