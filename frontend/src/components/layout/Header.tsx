import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Avatar } from '@/components/ui';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left} />
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
