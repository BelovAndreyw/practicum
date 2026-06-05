import { ReactNode } from 'react';
import styles from './Badge.module.css';

type Variant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'violet';

interface Props {
  children: ReactNode;
  variant?: Variant;
}

export function Badge({ children, variant = 'default' }: Props) {
  return <span className={[styles.badge, styles[variant]].join(' ')}>{children}</span>;
}
