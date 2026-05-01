import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  roles?: ('student' | 'captain' | 'organizer')[];
}

const NAV: NavItem[] = [
  { to: '/', icon: '🏠', label: 'Главная' },
  { to: '/profile', icon: '👤', label: 'Мой профиль' },
  { to: '/team', icon: '👥', label: 'Моя команда' },
  { to: '/teams', icon: '🔍', label: 'Команды' },
  { to: '/rating', icon: '🏆', label: 'Рейтинги' },
  { to: '/challenges', icon: '⚡', label: 'Челленджи' },
  { to: '/events', icon: '📅', label: 'События' },
  { to: '/tools', icon: '🛠️', label: 'Инструменты' },
  { to: '/admin', icon: '⚙️', label: 'Организатор', roles: ['organizer'] },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/favicon.svg" alt="КЗ" width={30} height={30} />
        <span className={styles.brandName}>Командный<br />зачёт</span>
      </div>

      <ul className={styles.nav}>
        {NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
