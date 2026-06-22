import { ExpandableCard } from '@/components/ui';
import type { NewsItem } from '@/types';
import styles from './NewsCard.module.css';

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const cover = item.images[0];
  const gallery = item.images.slice(1);
  const dateStr = new Date(item.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <article className={styles.wrapper}>
      {cover && (
        <div className={styles.cover}>
          <img src={cover.url} alt="" loading="lazy" />
        </div>
      )}
      <ExpandableCard
        className={cover ? styles.withCover : undefined}
        header={(
          <div>
            <p className={styles.meta}>
              {dateStr}
              {' · '}
              {item.authorName}
            </p>
            <h3 className={styles.title}>{item.title}</h3>
          </div>
        )}
      >
        <p className={styles.body}>{item.body}</p>
        {gallery.length > 0 && (
          <div className={styles.gallery}>
            {gallery.map((img) => (
              <img key={img.id} src={img.url} alt={img.filename} loading="lazy" />
            ))}
          </div>
        )}
      </ExpandableCard>
    </article>
  );
}
