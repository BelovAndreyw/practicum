import { useEffect, useMemo, useState } from 'react';
import { ratingApi } from '@/api';
import type { TeamRatingEntry, UserRatingEntry } from '@/types';
import { Avatar, Badge, Card, Empty, Input, PageHeader, Spinner, Tabs } from '@/components/ui';
import styles from './RatingPage.module.css';

const LEAGUE_VARIANT: Record<string, 'accent' | 'violet' | 'warning'> = {
  Новичок: 'accent',
  Профи: 'violet',
  Легенда: 'warning',
};

export function RatingPage() {
  const [tab, setTab] = useState('teams');
  const [teamRating, setTeamRating] = useState<TeamRatingEntry[]>([]);
  const [userRating, setUserRating] = useState<UserRatingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [streamFilter, setStreamFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    Promise.all([ratingApi.getTeamRating(), ratingApi.getUserRating()])
      .then(([tr, ur]) => {
        setTeamRating(tr);
        setUserRating(ur);
      })
      .finally(() => setLoading(false));
  }, []);

  const streamOptions = useMemo(() => {
    const unique = new Set(userRating.map((entry) => entry.stream).filter(Boolean) as string[]);
    return Array.from(unique);
  }, [userRating]);

  const teamOptions = useMemo(() => {
    const unique = new Set(userRating.map((entry) => entry.teamName).filter(Boolean) as string[]);
    return Array.from(unique);
  }, [userRating]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLowerCase();

    return userRating.filter((entry) => {
      const streamMatch = streamFilter === 'all' || entry.stream === streamFilter;
      const teamMatch = teamFilter === 'all' || entry.teamName === teamFilter;
      const searchable = [
        entry.user.firstName,
        entry.user.lastName,
        entry.teamName ?? '',
      ].join(' ').toLowerCase();
      const searchMatch = !normalizedSearch || searchable.includes(normalizedSearch);
      return streamMatch && teamMatch && searchMatch;
    });
  }, [userRating, streamFilter, teamFilter, studentSearch]);

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  const TABS = [
    { id: 'teams', label: '🏆 Команды' },
    { id: 'users', label: '👤 Студенты' },
    { id: 'top10', label: '🔥 ТОП-10' },
    { id: 'leagues', label: '🎖 Лиги' },
  ];

  return (
    <div>
      <PageHeader eyebrow="Рейтинги" title="Лидерборды" />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className={styles.content}>
        {tab === 'teams' && (
          <Card padding="lg">
            <span className="eyebrow">Рейтинг команд</span>

            {teamRating.length === 0 ? (
              <Empty message="Нет данных по командам" />
            ) : (
              <table className={[styles.table, styles.teamsTable].join(' ')}>
                <thead>
                  <tr>
                    <th className={styles.placeHeader}>Место</th>
                    <th>Команда</th>
                    <th>Лига</th>
                    <th className={styles.scoreHeader}>Баллы КРК</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRating.map((entry) => (
                    <tr key={entry.team.id} className={entry.rank <= 3 ? styles.top : ''}>
                      <td className={styles.placeCell}>
                        <Rank rank={entry.rank} />
                      </td>
                      <td className={styles.teamName}>{entry.team.name}</td>
                      <td>
                        <Badge variant={LEAGUE_VARIANT[entry.team.league] ?? 'accent'}>{entry.team.league}</Badge>
                      </td>
                      <td className={styles.krkCell}>{entry.team.krk.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'users' && (
          <Card padding="lg">
            <div className={styles.searchHeader}>
              <Input
                label="Поиск студента"
                placeholder="Введите имя, фамилию или команду..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>

            <div className={styles.filtersRow}>
              <label className={styles.filterField}>
                <span className={styles.filterLabel}>Поток</span>
                <select
                  className={styles.select}
                  value={streamFilter}
                  onChange={(event) => setStreamFilter(event.target.value)}
                >
                  <option value="all">Все потоки</option>
                  {streamOptions.map((stream) => (
                    <option key={stream} value={stream}>{stream}</option>
                  ))}
                </select>
              </label>

              <label className={styles.filterField}>
                <span className={styles.filterLabel}>Команда</span>
                <select
                  className={styles.select}
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                >
                  <option value="all">Все команды</option>
                  {teamOptions.map((teamName) => (
                    <option key={teamName} value={teamName}>{teamName}</option>
                  ))}
                </select>
              </label>
            </div>

            {filteredUsers.length === 0 ? (
              <Empty message="По выбранным фильтрам нет студентов" />
            ) : (
              <table className={[styles.table, styles.usersTable].join(' ')}>
                <thead>
                  <tr>
                    <th className={styles.placeHeader}>Место</th>
                    <th>Студент</th>
                    <th>Команда</th>
                    <th>Лига</th>
                    <th className={styles.scoreHeader}>Баллы</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((entry) => (
                    <tr key={entry.user.id} className={entry.rank <= 3 ? styles.top : ''}>
                      <td className={styles.placeCell}>
                        <Rank rank={entry.rank} />
                      </td>
                      <td>
                        <div className={styles.userCell}>
                          <Avatar name={`${entry.user.firstName} ${entry.user.lastName}`} src={entry.user.avatarUrl} size="sm" />
                          <span>{entry.user.firstName} {entry.user.lastName}</span>
                        </div>
                      </td>
                      <td className={styles.teamLabel}>{entry.teamName ?? '—'}</td>
                      <td>
                        <Badge variant={LEAGUE_VARIANT[entry.user.league] ?? 'accent'}>{entry.user.league}</Badge>
                      </td>
                      <td className={styles.krkCell}>{entry.user.personalRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'top10' && (
          <div className={styles.topGrid}>
            {userRating.slice(0, 10).map((entry) => (
              <Card key={entry.user.id} padding="sm" className={styles.topCard}>
                <div className={styles.topRank}>{rankMedal(entry.rank) ?? entry.rank}</div>
                <Avatar name={`${entry.user.firstName} ${entry.user.lastName}`} src={entry.user.avatarUrl} size="lg" />
                <p className={styles.topName}>{entry.user.firstName}<br />{entry.user.lastName}</p>
                <Badge variant={LEAGUE_VARIANT[entry.user.league] ?? 'accent'}>{entry.user.league}</Badge>
                <p className={styles.topScore}>{entry.user.personalRating}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === 'leagues' && (
          <div className={styles.leaguesGrid}>
            {(['Новичок', 'Профи', 'Легенда'] as const).map((league) => {
              const teams = teamRating.filter((entry) => entry.team.league === league);
              return (
                <Card key={league} padding="lg">
                  <div className={styles.leagueHeader}>
                    <h2 className={styles.leagueName}>{league}</h2>
                    <Badge variant={LEAGUE_VARIANT[league]}>{teams.length} команд</Badge>
                  </div>
                  <LeagueDesc league={league} />

                  {teams.length === 0 ? (
                    <Empty message="Команды в этой лиге пока не найдены" />
                  ) : (
                    teams.map((entry) => (
                      <div key={entry.team.id} className={styles.leagueTeam}>
                        <span className={styles.leaguePlace}>{entry.rank}</span>
                        <span className={styles.teamName}>{entry.team.name}</span>
                        <span className={styles.krkCell}>{entry.team.krk.toFixed(1)}</span>
                      </div>
                    ))
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Rank({ rank }: { rank: number }) {
  const medal = rankMedal(rank);

  return (
    <span className={styles.placeWrap}>
      {medal && <span className={styles.medal}>{medal}</span>}
      <span className={styles.placeNum}>{rank}</span>
    </span>
  );
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function LeagueDesc({ league }: { league: string }) {
  const desc: Record<string, string> = {
    Новичок: 'КРК до 60. Команды только начинают путь.',
    Профи: 'КРК от 60 до 89. Стабильные и активные команды.',
    Легенда: 'КРК от 90. Лучшие команды потока.',
  };

  return <p className={styles.leagueDesc}>{desc[league]}</p>;
}
