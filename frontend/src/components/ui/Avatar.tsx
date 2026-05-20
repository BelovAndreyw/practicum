import styles from './Avatar.module.css';

interface Props {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ src, name, size = 'md' }: Props) {
  if (src) {
    return <img src={src} alt={name} className={[styles.avatar, styles[size]].join(' ')} />;
  }
  return (
    <div className={[styles.avatar, styles.fallback, styles[size]].join(' ')} aria-label={name}>
      {initials(name)}
    </div>
  );
}
