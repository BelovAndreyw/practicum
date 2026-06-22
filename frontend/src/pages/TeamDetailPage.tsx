import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { teamsApi } from '@/api';
import type { KrkBreakdown, Team } from '@/types';
import { Avatar, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui';
import teamStyles from './TeamPage.module.css';
import styles from './TeamDetailPage.module.css';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [krk, setKrk] = useState<KrkBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.allSettled([teamsApi.getTeam(teamId), teamsApi.getKrkBreakdown(teamId)])
      .then(([teamResult, krkResult]) => {
        if (teamResult.status !== 'fulfilled') {
          throw teamResult.reason;
        }
        setTeam(teamResult.value);
        setKrk(krkResult.status === 'fulfilled' ? krkResult.value : null);
      })
      .catch(() => setError('Не удалось загрузить команду'))
      .finally(() => setLoading(false));
  }, [teamId]);

  const isCaptain = team?.captainId === user?.id;
  const isOwnTeam = user?.teamId === teamId;

  const inviteExpiresLabel = useMemo(() => {
    if (!team?.inviteCodeExpiresAt) return null;
    return new Date(team.inviteCodeExpiresAt).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [team?.inviteCodeExpiresAt]);

  const handleRegenCode = async () => {
    if (!team) return;
    setBusy(true);
    try {
      const regenerated = await teamsApi.regenerateInviteCode(team.id);
      setTeam({ ...team, ...regenerated });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={teamStyles.center}><Spinner size="lg" /></div>;
  }

  if (!team) {
    return (
      <div>
        <PageHeader eyebrow="Команда" title="Команда не найдена" />
        <div className={teamStyles.center}>
          <Empty icon="⚠️" message="Команда не найдена" hint={error || 'Проверьте ссылку'} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Команда"
        title={team.name}
        subtitle="Публичный профиль команды"
        actions={isOwnTeam ? (
          <Link to="/team" className={styles.manageLink}>Перейти в управление командой</Link>
        ) : undefined}
      />

      <div className={styles.grid}>
        <Card padding="lg" className={teamStyles.krkCard}>
          <span className="eyebrow">Командный рейтинг</span>
          <div className={teamStyles.krkTotal}>{team.krk.toFixed(2)}</div>
          <Badge variant={team.league === 'Легенда' ? 'warning' : team.league === 'Профи' ? 'violet' : 'accent'}>
            Лига: {team.league}
          </Badge>

          {krk && (
            <div className={teamStyles.krkBreakdown}>
              <KrkRow label="Базовый вклад" value={krk.baseRating} />
              <KrkRow label="Коэфф. сплочённости" value={krk.cohesionCoeff} />
              <KrkRow label="Бонусы" value={krk.bonusCoeff} />
            </div>
          )}
        </Card>

        {isCaptain && team.inviteCode && (
          <Card padding="lg">
            <span className="eyebrow">Приглашение в команду</span>
            <p className={teamStyles.inviteHint}>Код действует 24 часа после обновления.</p>

            <div className={teamStyles.inviteTop}>
              <div className={teamStyles.inviteCode}>{team.inviteCode}</div>
              <Button size="sm" variant="secondary" onClick={handleRegenCode} loading={busy}>Обновить</Button>
            </div>

            {inviteExpiresLabel && (
              <p className={teamStyles.inviteExpires}>Действует до: {inviteExpiresLabel}</p>
            )}
          </Card>
        )}

        <Card padding="lg" className={styles.membersCard}>
          <div className={teamStyles.panelHead}>
            <div>
              <span className="eyebrow">Команда</span>
              <h3 className={teamStyles.panelTitle}>Состав команды</h3>
            </div>
            <Badge variant="default">{team.members.length}</Badge>
          </div>

          <div className={teamStyles.membersGrid}>
            {team.members.map((member) => (
              <div key={member.userId} className={teamStyles.member}>
                <Link to={`/users/${member.userId}`} className={styles.memberLink}>
                  <Avatar name={`${member.firstName} ${member.lastName}`} src={member.avatarUrl} size="lg" />
                  <p className={teamStyles.memberName}>{member.firstName} {member.lastName}</p>
                  <p className={teamStyles.memberRole}>{member.role === 'captain' ? '★ Капитан' : 'Участник'}</p>
                  <div className={teamStyles.memberRatingBadge}>{member.personalRating.toFixed(2)}</div>
                  <span className={teamStyles.memberRatingLabel}>КРК</span>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KrkRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={teamStyles.krkRow}>
      <div className={teamStyles.krkRowLabel}>{label}</div>
      <div className={teamStyles.krkRowBar}>
        <div className={teamStyles.krkRowFill} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
      <span className={teamStyles.krkRowVal}>{value.toFixed(2)} / 100</span>
    </div>
  );
}
