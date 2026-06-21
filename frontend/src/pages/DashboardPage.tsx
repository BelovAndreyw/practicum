import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { activityApi, knowledgeApi, newsApi } from '@/api';
import type { ActivityEvent, KnowledgeRequest, KnowledgeRequestType, NewsItem } from '@/types';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner, Textarea } from '@/components/ui';
import styles from './DashboardPage.module.css';

const EVENT_ICON: Record<string, string> = {
  achievement_unlocked: '🏅',
  challenge_completed: '⚡',
  rating_updated: '📈',
  team_joined: '👥',
  rescue_completed: '🆘',
  event_created: '📅',
  checkin_submitted: '✅',
};

export function DashboardPage() {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeRequest[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'need' as KnowledgeRequestType, title: '', description: '', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      newsApi.list(),
      knowledgeApi.list({ resolved: false }),
      activityApi.getFeed(8),
    ])
      .then(([newsResult, knowledgeResult, activityResult]) => {
        if (newsResult.status === 'fulfilled') setNews(newsResult.value);
        if (knowledgeResult.status === 'fulfilled') setKnowledge(knowledgeResult.value);
        if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const k = await knowledgeApi.create({
        type: form.type,
        title: form.title,
        description: form.description,
        tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
      });

      setKnowledge((prev) => [k, ...prev]);
      setShowForm(false);
      setForm({ type: 'need', title: '', description: '', tags: '' });
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (id: string) => {
    await knowledgeApi.resolve(id);
    setKnowledge((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        eyebrow="Главная"
        title="Главная"
        subtitle={`Здесь сразу все обновления по сообществу и командам, ${user?.firstName}.`}
      />

      <div className={styles.grid}>
        <section className={styles.newsColumn}>
          <Card padding="lg">
            <div className={styles.sectionHead}>
              <div>
                <span className="eyebrow">Обновления</span>
                <h2 className={styles.sectionTitle}>Новости сообщества</h2>
              </div>
              <Badge variant="accent">{news.length}</Badge>
            </div>

            {news.length === 0 && <Empty icon="📰" message="Пока нет новостей" />}

            <div className={styles.newsList}>
              {news.map((item) => (
                <article key={item.id} className={styles.newsItem}>
                  <p className={styles.newsMeta}>
                    {new Date(item.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}
                    {item.authorName}
                  </p>
                  <h3 className={styles.newsTitle}>{item.title}</h3>
                  <p className={styles.newsBody}>{item.body}</p>
                </article>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <div className={styles.sectionHead}>
              <div>
                <span className="eyebrow">В командах</span>
                <h2 className={styles.sectionTitle}>Последняя активность</h2>
              </div>
            </div>

            {activity.length === 0 && <Empty icon="🔔" message="Пока нет новых событий" />}

            <div className={styles.activityList}>
              {activity.map((eventItem) => (
                <div key={eventItem.id} className={styles.activityItem}>
                  <span className={styles.activityIcon}>{EVENT_ICON[eventItem.type] ?? '🔔'}</span>
                  <div className={styles.activityBody}>
                    <p className={styles.activityTitle}>{eventItem.title}</p>
                    {eventItem.description && <p className={styles.activityDesc}>{eventItem.description}</p>}
                    <p className={styles.activityMeta}>{formatDate(eventItem.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className={styles.knowledgeColumn}>
          <Card padding="lg" className={styles.stickyCard}>
            <div className={styles.sectionHead}>
              <div>
                <span className="eyebrow">Помощь и обмен</span>
                <h2 className={styles.sectionTitle}>Биржа знаний</h2>
              </div>
              <Button size="sm" onClick={() => setShowForm(true)}>+ Разместить</Button>
            </div>

            {knowledge.length === 0 && (
              <Empty
                icon="💡"
                message="Пока пусто"
                hint="Разместите первый запрос помощи или предложение для других команд"
              />
            )}

            <div className={styles.knowledgeList}>
              {knowledge.map((item) => (
                <div key={item.id} className={styles.knowledgeItem}>
                  <div className={styles.knowledgeTop}>
                    <Badge variant={item.type === 'need' ? 'accent' : 'success'}>
                      {item.type === 'need' ? '🙋 Ищем' : '💡 Предлагаем'}
                    </Badge>
                    <span className={styles.knowledgeDate}>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                  </div>

                  <h3 className={styles.knowledgeTitle}>{item.title}</h3>
                  {item.description && <p className={styles.knowledgeDesc}>{item.description}</p>}

                  {item.tags.length > 0 && (
                    <div className={styles.knowledgeTags}>
                      {item.tags.map((tag) => <Badge key={tag} variant="default">{tag}</Badge>)}
                    </div>
                  )}

                  <div className={styles.knowledgeFoot}>
                    <span>{item.teamName ?? item.authorName}</span>
                    {(item.authorId === user?.id || (!!user?.teamId && item.teamId === user.teamId)) && (
                      <Button size="sm" variant="ghost" onClick={() => handleResolve(item.id)}>
                        ✓ Закрыть
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <Modal
        title="Разместить на бирже"
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.title.trim()}>Разместить</Button>
          </>
        )}
      >
        <div className={styles.formGrid}>
          <div className={styles.typeRow}>
            <label className={styles.typeLabel}>Тип</label>
            <div className={styles.typeBtns}>
              {(['need', 'offer'] as const).map((type) => (
                <button
                  key={type}
                  className={[styles.typeBtn, form.type === type ? styles.typeActive : ''].join(' ')}
                  onClick={() => setForm({ ...form, type })}
                >
                  {type === 'need' ? '🙋 Запрос помощи' : '💡 Предложение'}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Заголовок"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder={form.type === 'need' ? 'Ищем эксперта по Java' : 'Проведём разбор по физике'}
          />

          <Textarea
            label="Описание (необязательно)"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <Input
            label="Теги (через запятую)"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="Java, ООП, Spring"
          />
        </div>
      </Modal>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
