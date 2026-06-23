import { useEffect, useState } from 'react';
import { teamsApi, ratingApi } from '@/api';
import type { Team } from '@/types';
import { Card, Badge, Avatar, PageHeader, Input, Spinner, Empty } from '@/components/ui';
import styles from './TeamsListPage.module.css';

const LEAGUE_VARIANT: Record<string, 'accent' | 'violet' | 'warning'> = {
  'Новичок': 'accent', 'Профи': 'violet', 'Легенда': 'warning',
};

export function TeamsListPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [ranking, setRanking] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([teamsApi.listTeams(), ratingApi.getTeamRating()])
      .then(([ts, r]) => {
        setTeams(ts);
        setRanking(new Map(r.map((e) => [e.team.id, e.rank])));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = teams
    .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (ranking.get(a.id) ?? 99) - (ranking.get(b.id) ?? 99));

  return (
    <div>
      <PageHeader
        eyebrow="Команды"
        title="Все команды"
        subtitle="Список всех команд потока, отсортированных по КРК."
      />

      <div className={styles.searchBar}>
        <Input
          placeholder="Поиск по названию..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <div className={styles.center}><Spinner /></div>}
      {!loading && filtered.length === 0 && <Empty message="Команды не найдены" />}

      <div className={styles.grid}>
        {filtered.map((t) => {
          const rank = ranking.get(t.id);
          return (
            <Card key={t.id} padding="lg" hoverable className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.rankBadge}>{rank ? rankMedal(rank) : '—'}</div>
                <Badge variant={LEAGUE_VARIANT[t.league] ?? 'accent'}>{t.league}</Badge>
              </div>
              <h3 className={styles.teamName}>{t.name}</h3>
              <div className={styles.krkRow}>
                <span className={styles.krkVal}>{t.krk.toFixed(1)}</span>
                <span className={styles.krkLabel}>КРК</span>
              </div>
              <div className={styles.divider} />
              <div className={styles.members}>
                <div className={styles.avatarStack}>
                  {t.members.slice(0, 5).map((m) => (
                    <Avatar key={m.userId} name={`${m.firstName} ${m.lastName}`} src={m.avatarUrl} size="sm" />
                  ))}
                  {t.members.length > 5 && (
                    <span className={styles.moreCount}>+{t.members.length - 5}</span>
                  )}
                </div>
                <span className={styles.memberCount}>
                  {t.members.length} участник{t.members.length === 1 ? '' : t.members.length < 5 ? 'а' : 'ов'}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
