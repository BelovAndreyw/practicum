import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [teamFilter, setTeamFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    setTeamsLoading(true);
    setTeamsError(null);
    ratingApi.getTeamRating()
      .then(setTeamRating)
      .catch(() => setTeamsError('Не удалось загрузить рейтинг команд'))
      .finally(() => setTeamsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = studentSearch.trim();
    setUsersLoading(true);
    setUsersError(null);
    const timer = window.setTimeout(() => {
      ratingApi.getUserRating(q ? { q } : undefined)
        .then((rows) => { if (!cancelled) setUserRating(rows); })
        .catch(() => { if (!cancelled) setUsersError('Не удалось загрузить рейтинг студентов'); })
        .finally(() => { if (!cancelled) setUsersLoading(false); });
    }, q ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [studentSearch]);

  const teamOptions = useMemo(() => {
    const unique = new Set(userRating.map((entry) => entry.teamName).filter(Boolean) as string[]);
    return Array.from(unique);
  }, [userRating]);

  const filteredUsers = useMemo(() => {
    return userRating.filter((entry) => {
      const teamMatch = teamFilter === 'all' || entry.teamName === teamFilter;
      return teamMatch;
    });
  }, [userRating, teamFilter]);

  const initialLoading = teamsLoading && teamRating.length === 0 && usersLoading && userRating.length === 0;
  if (initialLoading) return <div className={styles.center}><Spinner size="lg" /></div>;

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

            {teamsLoading && teamRating.length === 0 ? (
              <div className={styles.center}><Spinner /></div>
            ) : teamsError && teamRating.length === 0 ? (
              <Empty message={teamsError} />
            ) : teamRating.length === 0 ? (
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
                      <td className={styles.teamName}>
                        <Link to={`/teams/${entry.team.id}`} className={styles.entityLink}>{entry.team.name}</Link>
                      </td>
                      <td>
                        <Badge variant={LEAGUE_VARIANT[getLeagueByKrk(entry.team.krk)] ?? 'accent'}>{getLeagueByKrk(entry.team.krk)}</Badge>
                      </td>
                      <td className={styles.krkCell}>{entry.team.krk.toFixed(2)}</td>
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

            {usersError && userRating.length === 0 ? (
              <Empty message={usersError} />
            ) : usersLoading && userRating.length === 0 ? (
              <div className={styles.center}><Spinner /></div>
            ) : filteredUsers.length === 0 ? (
              <Empty message="По выбранным фильтрам нет студентов" />
            ) : (
              <>
                {usersLoading && (
                  <div className={styles.center}><Spinner size="sm" /></div>
                )}
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
                            <Link to={`/users/${entry.user.id}`} className={styles.entityLink}>
                              {entry.user.firstName} {entry.user.lastName}
                            </Link>
                          </div>
                        </td>
                        <td className={styles.teamLabel}>
                          {entry.teamId ? (
                            <Link to={`/teams/${entry.teamId}`} className={styles.entityLink}>{entry.teamName ?? '—'}</Link>
                          ) : (
                            entry.teamName ?? '—'
                          )}
                        </td>
                        <td>
                          <Badge variant={LEAGUE_VARIANT[getLeagueByKrk(entry.user.personalRating)] ?? 'accent'}>
                            {getLeagueByKrk(entry.user.personalRating)}
                          </Badge>
                        </td>
                        <td className={styles.krkCell}>{entry.user.personalRating.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        )}

        {tab === 'top10' && (
          <div className={styles.topGrid}>
            {userRating.slice(0, 10).map((entry) => (
              <Link key={entry.user.id} to={`/users/${entry.user.id}`} className={styles.topCardLink}>
                <Card padding="sm" className={styles.topCard}>
                  <div className={styles.topRank}>{rankMedal(entry.rank) ?? entry.rank}</div>
                  <Avatar name={`${entry.user.firstName} ${entry.user.lastName}`} src={entry.user.avatarUrl} size="lg" />
                  <p className={styles.topName}>{entry.user.firstName}<br />{entry.user.lastName}</p>
                  <Badge variant={LEAGUE_VARIANT[getLeagueByKrk(entry.user.personalRating)] ?? 'accent'}>
                    {getLeagueByKrk(entry.user.personalRating)}
                  </Badge>
                  <p className={styles.topScore}>{entry.user.personalRating.toFixed(2)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {tab === 'leagues' && (
          <div className={styles.leaguesGrid}>
            {(['Новичок', 'Профи', 'Легенда'] as const).map((league) => {
              const teams = teamRating.filter((entry) => getLeagueByKrk(entry.team.krk) === league);
              return (
                <Card key={league} padding="lg" className={styles.leagueCard}>
                  <div className={styles.leagueHeader}>
                    <h2 className={styles.leagueName}>{league}</h2>
                    <Badge variant={LEAGUE_VARIANT[league]}>{teams.length} команд</Badge>
                  </div>
                  <LeagueDesc league={league} />

                  <div className={styles.leagueBody}>
                    {teams.length === 0 ? (
                      <div className={styles.leagueEmpty}>
                        <span className={styles.leagueEmptyIcon}>📭</span>
                        <span>Команды в этой лиге пока не найдены</span>
                      </div>
                    ) : (
                      teams.map((entry) => (
                        <div key={entry.team.id} className={styles.leagueTeam}>
                          <span className={styles.leaguePlace}>{entry.rank}</span>
                          <Link to={`/teams/${entry.team.id}`} className={[styles.teamName, styles.entityLink].join(' ')}>
                            {entry.team.name}
                          </Link>
                          <span className={styles.krkCell}>{entry.team.krk.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
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
    Профи: 'КРК от 60 до 85. Стабильные и активные команды.',
    Легенда: 'КРК от 85. Лучшие команды потока.',
  };

  return <p className={styles.leagueDesc}>{desc[league]}</p>;
}

function getLeagueByKrk(krk: number) {
  if (krk >= 85) return 'Легенда';
  if (krk >= 60) return 'Профи';
  return 'Новичок';
}
