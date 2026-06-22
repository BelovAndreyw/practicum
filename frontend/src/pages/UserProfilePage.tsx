import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { usersApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { User } from '@/types';
import { Avatar, Badge, Card, Empty, PageHeader, Spinner } from '@/components/ui';
import styles from './ProfilePage.module.css';

const LEAGUE_VARIANT: Record<string, 'accent' | 'violet' | 'warning'> = {
  Новичок: 'accent',
  Профи: 'violet',
  Легенда: 'warning',
};

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    usersApi.getUser(userId)
      .then(setProfile)
      .catch(() => setError('Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, [userId]);

  const ratingParts = useMemo(() => {
    if (profile?.krkBreakdown) {
      return [
        { label: 'Базовый рейтинг', val: profile.krkBreakdown.baseRating },
        { label: 'Сплоченность', val: profile.krkBreakdown.cohesionCoeff },
        { label: 'Бонусы', val: profile.krkBreakdown.bonusCoeff },
      ];
    }
    return [
      { label: 'Базовый рейтинг', val: 0 },
      { label: 'Сплоченность', val: 0 },
      { label: 'Бонусы', val: 0 },
    ];
  }, [profile?.krkBreakdown]);

  if (userId && currentUser?.id === userId) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return <div className={styles.center}><Spinner size="lg" /></div>;
  }

  if (!profile) {
    return (
      <div>
        <PageHeader eyebrow="Профиль" title="Пользователь не найден" />
        <Empty icon="👤" message="Профиль не найден" hint={error || 'Проверьте ссылку'} />
      </div>
    );
  }

  const fullName = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ');

  return (
    <div>
      <PageHeader eyebrow="Профиль" title={fullName || 'Студент'} />

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <Card padding="lg" className={styles.profileCard}>
            <div className={styles.avatarBlock}>
              <Avatar name={`${profile.firstName} ${profile.lastName}`} src={profile.avatarUrl} size="xl" />
              <h2 className={styles.name}>{fullName}</h2>
              <div className={styles.badges}>
                <Badge variant={LEAGUE_VARIANT[profile.league] ?? 'accent'}>{profile.league}</Badge>
                <Badge variant={profile.role === 'captain' ? 'violet' : 'default'}>
                  {profile.role === 'captain' ? 'Капитан' : profile.role === 'organizer' ? 'Организатор' : 'Участник'}
                </Badge>
              </div>
              {profile.teamId && (
                <Link to={`/teams/${profile.teamId}`} className={styles.teamLink}>
                  {profile.teamName ?? 'Команда'}
                </Link>
              )}
            </div>

            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{profile.personalRating.toFixed(2)}</span>
                <span className={styles.statLabel}>Рейтинг</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{profile.achievements.length}</span>
                <span className={styles.statLabel}>Достижений</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{profile.league}</span>
                <span className={styles.statLabel}>Лига</span>
              </div>
            </div>

            <div className={styles.ratingSection}>
              <div className={styles.ratingSectionHead}>
                <span className={styles.ratingLabel}>Личный рейтинг</span>
                <span className={styles.ratingNum}>{profile.personalRating.toFixed(2)} / 100</span>
              </div>
              <div className={styles.ratingBar}>
                <div className={styles.ratingFill} style={{ width: `${Math.min(profile.personalRating, 100)}%` }} />
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.rightCol}>
          <Card padding="lg">
            <span className="eyebrow">Достижения</span>
            <h3 className={styles.sectionTitle}>Достижения</h3>

            {profile.achievements.length === 0 && (
              <Empty icon="🏅" message="Пока нет достижений" />
            )}

            <div className={styles.achGrid}>
              {profile.achievements.map((item) => (
                <div key={item.id} className={styles.achCard}>
                  <span className={styles.achIcon}>{item.icon}</span>
                  <p className={styles.achTitle}>{item.title}</p>
                  <p className={styles.achDesc}>{item.description}</p>
                  <p className={styles.achDate}>{new Date(item.unlockedAt).toLocaleDateString('ru-RU')}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <h3 className={styles.sectionTitle}>Вклад в команду</h3>

            <div className={styles.ratingComponents}>
              {ratingParts.map((part) => (
                <div key={part.label} className={styles.ratingComp}>
                  <div className={styles.ratingCompHead}>
                    <span className={styles.ratingCompLabel}>{part.label}</span>
                    <span className={styles.ratingCompVal}>{part.val} / 100</span>
                  </div>
                  <div className={styles.ratingBar}>
                    <div className={styles.ratingFill} style={{ width: `${Math.min(part.val, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.ratingTotal}>
              <span>Итог:</span>
              <strong>{profile.personalRating.toFixed(2)}</strong>
              <span className={styles.ratingTotalLabel}> / 100</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
