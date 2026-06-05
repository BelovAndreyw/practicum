import { ReactNode } from 'react';
import styles from './Tabs.module.css';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  children?: ReactNode;
}

export function Tabs({ tabs, active, onChange, children }: Props) {
  return (
    <div>
      <div className={styles.bar} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className={[styles.tab, active === t.id ? styles.active : ''].join(' ')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
