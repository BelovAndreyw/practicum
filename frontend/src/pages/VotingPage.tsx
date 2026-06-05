import { useEffect, useState } from 'react';
import { votingApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import { teamsApi } from '@/api';
import type { VoteRound, TeamMember } from '@/types';
import { Card, Badge, Button, PageHeader, Avatar, Spinner, Empty } from '@/components/ui';
import styles from './VotingPage.module.css';

export function VotingPage() {
  const { user } = useAuth();
  const [round, setRound] = useState<VoteRound | null | undefined>(undefined);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user?.teamId) { setRound(null); return; }
    Promise.all([votingApi.getActiveRound(user.teamId), teamsApi.getTeam(user.teamId)])
      .then(([r, t]) => {
        setRound(r);
        setMembers(t.members.filter((m) => m.userId !== user.id));
      });
  }, [user]);

  const handleScore = (userId: string, score: number) => {
    setScores((prev) => ({ ...prev, [userId]: score }));
  };

  const handleSubmit = async () => {
    if (!round) return;
    setSubmitting(true);
    try {
      await Promise.all(
        members.map((m) =>
          votingApi.submitBallot({ roundId: round.id, targetUserId: m.userId, score: scores[m.userId] ?? 3 })
        )
      );
      setSubmitted(true);
    } finally { setSubmitting(false); }
  };

  if (round === undefined) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        eyebrow="Голосование"
        title="Анонимное оценивание"
        subtitle="Оцените вклад каждого участника вашей команды по 5-балльной шкале. Голоса анонимны."
      />

      {!round && (
        <Empty icon="🗳️" message="Нет активного раунда голосования" hint="Организаторы откроют голосование в конце цикла." />
      )}

      {round && submitted && (
        <Card padding="lg" className={styles.successCard}>
          <p className={styles.successIcon}>🎉</p>
          <h2>Голоса учтены!</h2>
          <p className={styles.successDesc}>Ваши оценки отправлены анонимно. Результаты будут учтены при расчёте личного рейтинга участников.</p>
        </Card>
      )}

      {round && !submitted && (
        <>
          <div className={styles.roundBadge}>
            <Badge variant="accent">{round.cycleLabel}</Badge>
            <span className={styles.closesAt}>
              Закрывается: {new Date(round.closesAt).toLocaleDateString('ru-RU')}
            </span>
          </div>

          <div className={styles.memberList}>
            {members.map((m) => (
              <Card key={m.userId} padding="md" className={styles.memberCard}>
                <div className={styles.memberInfo}>
                  <Avatar name={`${m.firstName} ${m.lastName}`} src={m.avatarUrl} size="md" />
                  <div>
                    <p className={styles.memberName}>{m.firstName} {m.lastName}</p>
                    <p className={styles.memberRole}>{m.role === 'captain' ? 'Капитан' : 'Участник'}</p>
                  </div>
                </div>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      className={[styles.star, (scores[m.userId] ?? 0) >= s ? styles.starActive : ''].join(' ')}
                      onClick={() => handleScore(m.userId, s)}
                    >
                      ★
                    </button>
                  ))}
                  <span className={styles.scoreLabel}>{scores[m.userId] ? `${scores[m.userId]}/5` : 'не оценено'}</span>
                </div>
              </Card>
            ))}
          </div>

          <div className={styles.submitRow}>
            <Button onClick={handleSubmit} loading={submitting} disabled={members.some((m) => !scores[m.userId])}>
              Отправить оценки
            </Button>
            {members.some((m) => !scores[m.userId]) && (
              <p className={styles.hint}>Оцените всех участников перед отправкой</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
