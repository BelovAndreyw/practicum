import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  shortLabel: string;
  roles?: ('student' | 'captain' | 'organizer')[];
}

const NAV: NavItem[] = [
  { to: '/', icon: '🏠', label: 'Главная', shortLabel: 'Главная' },
  { to: '/profile', icon: '👤', label: 'Мой профиль', shortLabel: 'Профиль' },
  { to: '/team', icon: '👥', label: 'Моя команда', shortLabel: 'Команда' },
  { to: '/teams', icon: '🔍', label: 'Команды', shortLabel: 'Команды' },
  { to: '/rating', icon: '🏆', label: 'Рейтинги', shortLabel: 'Рейтинг' },
  { to: '/challenges', icon: '⚡', label: 'Челленджи', shortLabel: 'Челлендж' },
  { to: '/events', icon: '📅', label: 'События', shortLabel: 'События' },
  { to: '/tools', icon: '🛠️', label: 'Инструменты', shortLabel: 'Инстр.' },
  { to: '/admin', icon: '⚙️', label: 'Организатор', shortLabel: 'Орг.', roles: ['organizer'] },
];

export function Sidebar() {
  const { user } = useAuth();
  const navItems = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const mobileCols = Math.ceil(navItems.length / 2);

  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/favicon.svg" alt="КЗ" width={30} height={30} />
        <span className={styles.brandName}>Командный<br />зачёт</span>
      </div>

      <ul
        className={styles.nav}
        style={{ '--nav-cols': mobileCols } as React.CSSProperties}
      >
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.labelFull}>{item.label}</span>
              <span className={styles.labelShort}>{item.shortLabel}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
