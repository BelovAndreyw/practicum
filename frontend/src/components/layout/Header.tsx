import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Avatar } from '@/components/ui';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const showBack = location.pathname !== '/';

  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/');
    } else {
      navigate(-1);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack && (
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Назад
          </button>
        )}
      </div>
      <div className={styles.right}>
        {user && (
          <div className={styles.user}>
            <div className={styles.userInfo} onClick={() => navigate('/profile')}>
              <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} size="sm" />
              <div className={styles.userText}>
                <span className={styles.userName}>{user.firstName} {user.lastName}</span>
                <span className={styles.userLeague}>{user.league}</span>
              </div>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Выйти">
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
