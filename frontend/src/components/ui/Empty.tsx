import styles from './Empty.module.css';

interface Props {
  icon?: string;
  message: string;
  hint?: string;
}

export function Empty({ icon = '📭', message, hint }: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.icon}>{icon}</span>
      <p className={styles.msg}>{message}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
