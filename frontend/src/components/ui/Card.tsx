import { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export function Card({ children, padding = 'md', hoverable = false, className = '', ...rest }: Props) {
  return (
    <div
      className={[styles.card, styles[padding], hoverable ? styles.hoverable : '', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
