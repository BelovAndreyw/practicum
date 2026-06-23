import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { teamsApi, ratingApi, usersApi } from '@/api';
import type { Team, User } from '@/types';
import { Card, Badge, Avatar, PageHeader, Input, Spinner, Empty, Button, Modal } from '@/components/ui';
import styles from './TeamsListPage.module.css';

const LEAGUE_VARIANT: Record<string, 'accent' | 'violet' | 'warning'> = {
  'Новичок': 'accent', 'Профи': 'violet', 'Легенда': 'warning',
};

export function TeamsListPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [ranking, setRanking] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  useEffect(() => {
    Promise.allSettled([teamsApi.listTeams(), ratingApi.getTeamRating()])
      .then(([teamsResult, ratingResult]) => {
        if (teamsResult.status !== 'fulfilled') return;

        const ratingByTeamId = ratingResult.status === 'fulfilled'
          ? new Map(ratingResult.value.map((e) => [e.team.id, e]))
          : null;

        setTeams(teamsResult.value.map((team) => {
          const rating = ratingByTeamId?.get(team.id);
          if (!rating) return team;
          return { ...team, krk: rating.team.krk, league: rating.team.league };
        }));

        if (ratingResult.status === 'fulfilled') {
          setRanking(new Map(ratingResult.value.map((e) => [e.team.id, e.rank])));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = teams
    .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (ranking.get(a.id) ?? 99) - (ranking.get(b.id) ?? 99));

  const openMemberProfile = async (userId: string) => {
    setMemberLoading(true);
    setSelectedMember(null);
    try {
      setSelectedMember(await usersApi.getUser(userId));
    } finally {
      setMemberLoading(false);
    }
  };

  const closeMemberProfile = () => {
    setSelectedMember(null);
    setMemberLoading(false);
  };

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
            <Card
              key={t.id}
              padding="lg"
              hoverable
              className={styles.card}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTeam(t)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedTeam(t);
                }
              }}
            >
              <div className={styles.cardTop}>
                <div className={styles.rankBadge}>{rank ? rankMedal(rank) : '—'}</div>
                <Badge variant={LEAGUE_VARIANT[t.league] ?? 'accent'}>{t.league}</Badge>
              </div>
              <h3 className={styles.teamName}>{t.name}</h3>
              <div className={styles.krkRow}>
                <span className={styles.krkVal}>{t.krk.toFixed(2)}</span>
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

      <Modal
        title={selectedTeam ? `Состав команды «${selectedTeam.name}»` : 'Состав команды'}
        open={!!selectedTeam}
        onClose={() => setSelectedTeam(null)}
        footer={(
          <>
            {selectedTeam && (
              <Link to={`/teams/${selectedTeam.id}`} className={styles.teamPageLink} onClick={() => setSelectedTeam(null)}>
                Открыть страницу команды
              </Link>
            )}
            <Button variant="secondary" onClick={() => setSelectedTeam(null)}>Закрыть</Button>
          </>
        )}
      >
        {selectedTeam && (
          <div className={styles.teamMembersModal}>
            <div className={styles.teamModalSummary}>
              <Badge variant={LEAGUE_VARIANT[selectedTeam.league] ?? 'accent'}>{selectedTeam.league}</Badge>
              <span>{selectedTeam.krk.toFixed(1)} КРК</span>
              <span>{selectedTeam.members.length} участник{selectedTeam.members.length === 1 ? '' : selectedTeam.members.length < 5 ? 'а' : 'ов'}</span>
            </div>

            <div className={styles.teamMemberList}>
              {selectedTeam.members.map((member) => (
                <button
                  type="button"
                  key={member.userId}
                  className={styles.teamMemberButton}
                  onClick={() => openMemberProfile(member.userId)}
                >
                  <Avatar name={`${member.firstName} ${member.lastName}`} src={member.avatarUrl} size="md" />
                  <div className={styles.teamMemberInfo}>
                    <p className={styles.teamMemberName}>{member.firstName} {member.lastName}</p>
                    <p className={styles.teamMemberRole}>{member.role === 'captain' ? 'Капитан' : 'Участник'}</p>
                  </div>
                  <span className={styles.teamMemberRating}>{member.personalRating}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={memberLoading ? 'Профиль участника' : selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Профиль участника'}
        open={memberLoading || !!selectedMember}
        onClose={closeMemberProfile}
        footer={<Button variant="secondary" onClick={closeMemberProfile}>Закрыть</Button>}
      >
        {memberLoading && <div className={styles.memberModalCenter}><Spinner /></div>}
        {selectedMember && (
          <div className={styles.memberProfile}>
            <Avatar name={`${selectedMember.firstName} ${selectedMember.lastName}`} src={selectedMember.avatarUrl} size="xl" />
            <div className={styles.memberDetails}>
              <p><strong>ФИО:</strong> {[selectedMember.lastName, selectedMember.firstName, selectedMember.middleName].filter(Boolean).join(' ')}</p>
              <p><strong>Email:</strong> {selectedMember.email}</p>
              <p><strong>Телефон:</strong> {selectedMember.phone ?? 'не указан'}</p>
              {selectedMember.studentId && <p><strong>Учебный ID:</strong> {selectedMember.studentId}</p>}
              <p><strong>Рейтинг:</strong> {selectedMember.personalRating}</p>
              <p><strong>Роль:</strong> {selectedMember.role === 'captain' ? 'капитан' : selectedMember.role === 'organizer' ? 'организатор' : 'студент'}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
