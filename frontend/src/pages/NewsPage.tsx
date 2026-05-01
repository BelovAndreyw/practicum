import { useEffect, useState } from 'react';
import { newsApi } from '@/api';
import type { NewsItem } from '@/types';
import { Card, PageHeader, Spinner, Empty } from '@/components/ui';
import styles from './NewsPage.module.css';

export function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    newsApi.list().then(setNews).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader eyebrow="Информация" title="Новости" subtitle="Официальные объявления от организаторов игры." />

      {news.length === 0 && <Empty icon="📰" message="Новостей пока нет" />}

      <div className={styles.list}>
        {news.map((n) => (
          <Card key={n.id} padding="lg">
            <p className={styles.date}>
              {new Date(n.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}· {n.authorName}
            </p>
            <h2 className={styles.title}>{n.title}</h2>
            <p className={styles.body}>{n.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
