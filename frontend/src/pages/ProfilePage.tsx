import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { activityApi, usersApi } from '@/api';
import { externalMediaUrl, isApiMediaUrl } from '@/api/mappers/user';
import { useAuth } from '@/features/auth/AuthContext';
import type { ActivityEvent } from '@/types';
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader } from '@/components/ui';
import { ACHIEVEMENT_CATALOG } from '@/constants/achievements';
import { readImagePreviewUrl } from '@/utils/imagePreview';
import styles from './ProfilePage.module.css';

const LEAGUE_VARIANT: Record<string, 'accent' | 'violet' | 'warning'> = {
  Новичок: 'accent',
  Профи: 'violet',
  Легенда: 'warning',
};

export function ProfilePage() {
  const { user, updateProfile, refreshUser } = useAuth();

  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    avatarUrl: '',
  });

  useEffect(() => {
    activityApi.getFeed(6).then(setFeed);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName ?? '',
      email: user.email,
      phone: user.phone ?? '',
      avatarUrl: externalMediaUrl(user.avatarUrl),
    });
    setPendingAvatarFile(null);
    setAvatarPreviewUrl(null);
  }, [user]);

  const personalRating = user?.personalRating ?? 0;
  const ratingParts = useMemo(() => {
    if (user?.krkBreakdown) {
      return [
        { label: 'Базовый рейтинг', val: user.krkBreakdown.baseRating },
        { label: 'Сплоченность', val: user.krkBreakdown.cohesionCoeff },
        { label: 'Бонусы', val: user.krkBreakdown.bonusCoeff },
      ];
    }
    return [
      { label: 'Базовый рейтинг', val: 0 },
      { label: 'Сплоченность', val: 0 },
      { label: 'Бонусы', val: 0 },
    ];
  }, [user?.krkBreakdown, personalRating]);

  if (!user) return null;

  const fullName = [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');
  const unlockedIds = new Set(user.achievements.map((item) => item.id));
  const hasUploadedAvatar = isApiMediaUrl(user.avatarUrl);
  const editAvatarPreview = avatarPreviewUrl
    ?? (form.avatarUrl || (hasUploadedAvatar ? user.avatarUrl : undefined));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setSaving(true);
    try {
      if (pendingAvatarFile) {
        await usersApi.uploadAvatar(pendingAvatarFile);
        await refreshUser();
      }
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        ...(pendingAvatarFile
          ? {}
          : { avatarUrl: form.avatarUrl.trim() || null }),
      });
      setPendingAvatarFile(null);
      setAvatarPreviewUrl(null);
      setShowEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingAvatarFile(file);
    setAvatarPreviewUrl(await readImagePreviewUrl(file));
    event.target.value = '';
  };

  const handleRemoveUploadedAvatar = async () => {
    setSaving(true);
    try {
      await usersApi.removeAvatar();
      await refreshUser();
      setPendingAvatarFile(null);
      setAvatarPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Профиль"
        title="Мой профиль"
        actions={<Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>Редактировать профиль</Button>}
      />

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <Card padding="lg" className={styles.profileCard}>
            <div className={styles.avatarBlock}>
              <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} size="xl" />
              <h2 className={styles.name}>{fullName}</h2>
              {user.studentId && <p className={styles.studentId}>№ {user.studentId}</p>}
              <p className={styles.email}>{user.email}</p>
              {user.phone && <p className={styles.email}>{user.phone}</p>}
              <div className={styles.badges}>
                <Badge variant={LEAGUE_VARIANT[user.league] ?? 'accent'}>{user.league}</Badge>
                <Badge variant={user.role === 'captain' ? 'violet' : 'default'}>
                  {user.role === 'captain' ? 'Капитан' : user.role === 'organizer' ? 'Организатор' : 'Участник'}
                </Badge>
              </div>
            </div>

            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{user.personalRating.toFixed(2)}</span>
                <span className={styles.statLabel}>Рейтинг</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{user.achievements.length}</span>
                <span className={styles.statLabel}>Достижений</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{user.league}</span>
                <span className={styles.statLabel}>Лига</span>
              </div>
            </div>

            <div className={styles.ratingSection}>
              <div className={styles.ratingSectionHead}>
                <span className={styles.ratingLabel}>Личный рейтинг</span>
                <span className={styles.ratingNum}>{user.personalRating.toFixed(2)} / 100</span>
              </div>
              <div className={styles.ratingBar}>
                <div className={styles.ratingFill} style={{ width: `${Math.min(user.personalRating, 100)}%` }} />
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <span className="eyebrow">История</span>
            <h3 className={styles.sectionTitle}>Мои события</h3>
            {feed.length === 0 && <p className={styles.emptyFeed}>Активности пока нет.</p>}
            <div className={styles.feedList}>
              {feed.slice(0, 5).map((item) => (
                <div key={item.id} className={styles.feedItem}>
                  <p className={styles.feedTitle}>{item.title}</p>
                  <p className={styles.feedTime}>{new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={styles.rightCol}>
          <Card padding="lg">
            <span className="eyebrow">Достижения</span>
            <h3 className={styles.sectionTitle}>Мои достижения</h3>

            {user.achievements.length === 0 && (
              <Empty icon="🏅" message="Пока нет достижений" hint="Выполняйте задания и помогайте команде" />
            )}

            <div className={styles.achGrid}>
              {user.achievements.map((item) => (
                <div key={item.id} className={styles.achCard}>
                  <span className={styles.achIcon}>{item.icon}</span>
                  <p className={styles.achTitle}>{item.title}</p>
                  <p className={styles.achDesc}>{item.description}</p>
                  <p className={styles.achDate}>{new Date(item.unlockedAt).toLocaleDateString('ru-RU')}</p>
                </div>
              ))}

              {ACHIEVEMENT_CATALOG.filter((item) => !unlockedIds.has(item.id)).map((item) => (
                <div key={item.id} className={[styles.achCard, styles.achLocked].join(' ')}>
                  <span className={styles.achIcon}>🔒</span>
                  <p className={styles.achTitle}>{item.title}</p>
                  <p className={styles.achDesc}>{item.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <h3 className={styles.sectionTitle}>Вклад в команду</h3>
            <p className={styles.ratingDetailNote}>
              Рейтинг складывается из вклада в работу команды, активности на платформе и бонусов от организаторов.
            </p>

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
              <strong>{user.personalRating.toFixed(2)}</strong>
              <span className={styles.ratingTotalLabel}> / 100</span>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="Редактирование профиля"
        open={showEdit}
        onClose={() => setShowEdit(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>Отмена</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.firstName.trim() || !form.lastName.trim()}>
              Сохранить
            </Button>
          </>
        )}
      >
        <div className={styles.formGrid}>
          <Input label="Имя" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <Input label="Фамилия" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <Input label="Отчество" value={form.middleName} onChange={(event) => setForm({ ...form, middleName: event.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@urfu.ru" />
          <Input label="Телефон" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+7 900 000-00-00" />
          <div className={styles.photoField}>
            <span className={styles.photoLabel}>Фото</span>
            <div className={styles.photoControls}>
              {editAvatarPreview && (
                <Avatar name={`${form.firstName} ${form.lastName}`} src={editAvatarPreview} size="md" />
              )}
              <label className={styles.uploadButton} htmlFor="profile-photo-upload">+ Загрузить</label>
              {(hasUploadedAvatar || pendingAvatarFile) && (
                <Button size="sm" variant="secondary" onClick={handleRemoveUploadedAvatar} loading={saving}>
                  Удалить загруженное
                </Button>
              )}
              <input
                id="profile-photo-upload"
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={handleAvatarUpload}
              />
            </div>
          </div>
          <Input
            label="Ссылка на аватар"
            value={form.avatarUrl}
            onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
            placeholder="https://..."
            hint="Используется, если файл не загружен на сервер"
          />
        </div>
      </Modal>
    </div>
  );
}
