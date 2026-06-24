import { useEffect, useState } from 'react';
import { checkinApi, rescueApi, votingApi, teamsApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { CheckIn, RescueRequest, VoteRound, TeamMember } from '@/types';
import { Card, Badge, Button, PageHeader, Modal, Input, Textarea, Avatar, Spinner, Empty } from '@/components/ui';
import styles from './ToolsPage.module.css';

type Tab = 'checkin' | 'rescue' | 'voting';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает', accepted: 'Принято', confirmed: 'Подтверждено', rejected: 'Отклонено',
};
const STATUS_VAR: Record<string, 'default' | 'accent' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning', accepted: 'accent', confirmed: 'success', rejected: 'danger',
};

export function ToolsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>('checkin');

  // Check-in state
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [showCiForm, setShowCiForm] = useState(false);
  const [ciForm, setCiForm] = useState({ weekLabel: '', summary: '', achievements: '' });
  const [ciSaving, setCiSaving] = useState(false);
  const [ciSuccess, setCiSuccess] = useState(false);

  // Rescue state
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [showRescueForm, setShowRescueForm] = useState(false);
  const [rescueForm, setRescueForm] = useState({ topic: '', description: '' });
  const [rescueSaving, setRescueSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Voting state
  const [round, setRound] = useState<VoteRound | null | undefined>(undefined);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [voteSaving, setVoteSaving] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const teamId = user?.teamId;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const errors: string[] = [];

      try {
        const rescuesData = await rescueApi.list();
        if (!cancelled) setRescues(rescuesData);
      } catch {
        errors.push('спасения');
      }

      if (teamId) {
        try {
          const ci = await checkinApi.list(teamId);
          if (!cancelled) setCheckins(ci);
        } catch {
          errors.push('check-in');
        }

        try {
          const vr = await votingApi.getActiveRound(teamId);
          if (!cancelled) {
            setRound(vr);
            if (vr?.hasVoted) setVoteSubmitted(true);
          }
        } catch {
          errors.push('голосование');
        }

        try {
          const team = await teamsApi.getTeam(teamId);
          if (!cancelled && user) {
            setMembers(team.members.filter((m) => m.userId !== user.id));
          }
        } catch {
          errors.push('команду');
        }
      }

      if (!cancelled && errors.length) {
        setLoadError(`Не удалось загрузить: ${errors.join(', ')}`);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Check-in handlers
  const handleCiSubmit = async () => {
    if (!user?.teamId) return;
    setCiSaving(true);
    try {
      const ci = await checkinApi.submit({ teamId: user.teamId, ...ciForm });
      setCheckins((prev) => [ci, ...prev]);
      setShowCiForm(false);
      setCiSuccess(true);
      setCiForm({ weekLabel: '', summary: '', achievements: '' });
      await refreshUser();
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось отправить check-in');
    } finally { setCiSaving(false); }
  };

  // Rescue handlers
  const handleRescueCreate = async () => {
    setRescueSaving(true);
    try {
      const r = await rescueApi.create(rescueForm);
      setRescues((prev) => [r, ...prev]);
      setShowRescueForm(false);
      setRescueForm({ topic: '', description: '' });
    } finally { setRescueSaving(false); }
  };

  const handleAccept = async (id: string) => {
    const r = await rescueApi.updateStatus(id, 'accepted');
    setRescues((prev) => prev.map((x) => (x.id === id ? r : x)));
  };

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    try {
      const r = await rescueApi.updateStatus(id, 'confirmed');
      setRescues((prev) => prev.map((x) => (x.id === id ? r : x)));
      await refreshUser();
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось подтвердить помощь');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await rescueApi.updateStatus(id, 'rejected');
      setRescues((prev) => prev.filter((x) => x.id !== id));
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось отменить заявку');
    } finally {
      setRejectingId(null);
    }
  };

  // Voting handlers
  const handleScore = (userId: string, score: number) =>
    setScores((prev) => ({ ...prev, [userId]: score }));

  const handleVoteSubmit = async () => {
    if (!round) return;
    setVoteSaving(true);
    try {
      await votingApi.submitBallots(
        round.id,
        members.map((m) => ({
          targetUserId: m.userId,
          score: scores[m.userId] ?? 3,
        })),
      );
      setVoteSubmitted(true);
      await refreshUser();
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось отправить оценки');
    } finally { setVoteSaving(false); }
  };

  if (authLoading || loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  if (!user?.teamId) {
    return (
      <div className={styles.page}>
        <PageHeader
          eyebrow="Командные инструменты"
          title="Инструменты"
          subtitle="Еженедельные отчёты, запросы помощи и оценивание вклада участников."
        />
        <Empty icon="👥" message="Вы не состоите в команде" hint="Вступите в команду, чтобы пользоваться check-in и голосованием." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {loadError && <p className={styles.loadError}>{loadError}</p>}
      <PageHeader
        eyebrow="Командные инструменты"
        title="Инструменты"
        subtitle="Еженедельные отчёты, запросы помощи и оценивание вклада участников."
      />

      <div className={styles.tabBar}>
        {([
          ['checkin', '✅', 'Check-in'],
          ['rescue',  '🆘', 'Спасение'],
          ['voting',  '🗳️', 'Голосование'],
        ] as const).map(([id, icon, label]) => (
          <button
            key={id}
            className={[styles.tabBtn, tab === id ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(id)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── CHECK-IN ── */}
      {tab === 'checkin' && (
        <div className={styles.twoCol}>
          {/* Форма / кнопка */}
          <div className={styles.colLeft}>
            {ciSuccess && (
              <div className={styles.successBanner}>✅ Check-in отправлен организаторам!</div>
            )}
            {!showCiForm ? (
              <Card padding="lg" className={styles.actionCard}>
                <span className={styles.actionIcon}>✅</span>
                <h3 className={styles.actionTitle}>Отправить еженедельный отчёт</h3>
                <p className={styles.actionDesc}>
                  Расскажите организаторам, что команда сделала за неделю и чего достигла.
                </p>
                <Button onClick={() => { setShowCiForm(true); setCiSuccess(false); }}>
                  Новый check-in
                </Button>
              </Card>
            ) : (
              <Card padding="lg">
                <h3 className={styles.formTitle}>Новый Check-in</h3>
                <div className={styles.form}>
                  <Input label="Неделя" value={ciForm.weekLabel} onChange={(e) => setCiForm({ ...ciForm, weekLabel: e.target.value })} placeholder="Неделя 3" />
                  <Textarea label="Что сделали?" value={ciForm.summary} onChange={(e) => setCiForm({ ...ciForm, summary: e.target.value })} placeholder="Кратко о результатах..." />
                  <Textarea label="Достижения" value={ciForm.achievements} onChange={(e) => setCiForm({ ...ciForm, achievements: e.target.value })} placeholder="Завершили челлендж, воркшоп..." />
                  <div className={styles.formBtns}>
                    <Button onClick={handleCiSubmit} loading={ciSaving} disabled={!ciForm.weekLabel || !ciForm.summary}>Отправить</Button>
                    <Button variant="ghost" onClick={() => setShowCiForm(false)}>Отмена</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* История */}
          <div className={styles.colRight}>
            <h3 className={styles.histTitle}>История check-in</h3>
            {checkins.length === 0
              ? <Empty icon="📋" message="Ещё не было check-in" hint="Отправьте первый отчёт" />
              : checkins.map((ci) => (
                <Card key={ci.id} padding="md" className={styles.ciItem}>
                  <div className={styles.ciHead}>
                    <Badge variant="accent">{ci.weekLabel}</Badge>
                    <span className={styles.ciDate}>{new Date(ci.submittedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <p className={styles.ciField}><strong>Итоги:</strong> {ci.summary}</p>
                  <p className={styles.ciField}><strong>Достижения:</strong> {ci.achievements || '—'}</p>
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* ── RESCUE ── */}
      {tab === 'rescue' && (
        <div className={styles.twoCol}>
          <div className={styles.colLeft}>
            <Card padding="lg" className={styles.actionCard}>
              <span className={styles.actionIcon}>🆘</span>
              <h3 className={styles.actionTitle}>Запросить помощь</h3>
              <p className={styles.actionDesc}>
                Разместите заявку — другая команда откликнется и поможет разобраться с темой.
                Обе команды получат бонусные баллы после подтверждения.
              </p>
              <Button onClick={() => setShowRescueForm(true)}>Запросить спасение</Button>
            </Card>
          </div>

          <div className={styles.colRight}>
            <h3 className={styles.histTitle}>Заявки на спасение</h3>
            {rescues.length === 0
              ? <Empty icon="🆘" message="Нет заявок" hint="Создайте первую заявку на помощь" />
              : rescues.map((r) => (
                <Card key={r.id} padding="md" className={styles.rescueItem}>
                  <div className={styles.rescueHead}>
                    <Badge variant={STATUS_VAR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    <span className={styles.rescueBonus}>+{r.bonusPoints} pts</span>
                  </div>
                  <h4 className={styles.rescueTopic}>{r.topic}</h4>
                  <p className={styles.rescueDesc}>{r.description}</p>
                  <div className={styles.rescueMeta}>
                    <span>От: {r.requesterTeamName}</span>
                    {r.helperTeamName && <span>→ {r.helperTeamName}</span>}
                  </div>
                  {r.status === 'pending' && user?.teamId && r.requesterTeamId !== user.teamId && (
                    <Button size="sm" variant="secondary" onClick={() => handleAccept(r.id)} style={{ marginTop: 10 }}>Помочь</Button>
                  )}
                  {(r.status === 'pending' || r.status === 'accepted') && user?.teamId === r.requesterTeamId && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.status === 'accepted' && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(r.id)}
                          loading={confirmingId === r.id}
                        >
                          ✅ Подтвердить
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(r.id)}
                        loading={rejectingId === r.id}
                      >
                        Отменить заявку
                      </Button>
                    </div>
                  )}
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* ── VOTING ── */}
      {tab === 'voting' && (
        <div className={styles.votingWrap}>
          {round === null && (
            <Empty icon="🗳️" message="Нет активного раунда" hint="Организаторы откроют голосование в конце цикла." />
          )}
          {round && voteSubmitted && (
            <Card padding="lg" className={styles.voteSuccess}>
              <span className={styles.voteSuccessIcon}>🎉</span>
              <h2>Голоса учтены!</h2>
              <p className={styles.voteSuccessDesc}>Ваши оценки отправлены анонимно и будут учтены при расчёте рейтинга участников.</p>
            </Card>
          )}
          {round && !voteSubmitted && (
            <>
              <div className={styles.roundInfo}>
                <Badge variant="accent">{round.cycleLabel}</Badge>
                <span className={styles.roundClose}>Закрывается: {new Date(round.closesAt).toLocaleDateString('ru-RU')}</span>
                <p className={styles.roundHint}>Оцените вклад каждого участника вашей команды по 5-балльной шкале. Голоса анонимны.</p>
              </div>
              <div className={styles.membersGrid}>
                {members.map((m) => (
                  <Card key={m.userId} padding="md" className={styles.memberCard}>
                    <div className={styles.memberInfo}>
                      <Avatar name={`${m.firstName} ${m.lastName}`} src={m.avatarUrl} size="lg" />
                      <p className={styles.memberName}>{m.firstName} {m.lastName}</p>
                      <p className={styles.memberRole}>{m.role === 'captain' ? 'Капитан' : 'Участник'}</p>
                    </div>
                    <div className={styles.stars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          className={[styles.star, (scores[m.userId] ?? 0) >= s ? styles.starActive : ''].join(' ')}
                          onClick={() => handleScore(m.userId, s)}
                        >★</button>
                      ))}
                    </div>
                    <span className={styles.scoreLabel}>
                      {scores[m.userId] ? `${scores[m.userId]} / 5` : 'не оценен'}
                    </span>
                  </Card>
                ))}
              </div>
              <div className={styles.submitRow}>
                <Button size="lg" onClick={handleVoteSubmit} loading={voteSaving} disabled={members.some((m) => !scores[m.userId])}>
                  Отправить оценки
                </Button>
                {members.some((m) => !scores[m.userId]) && (
                  <p className={styles.submitHint}>Оцените всех участников</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rescue modal */}
      <Modal
        title="Запрос на спасение"
        open={showRescueForm}
        onClose={() => setShowRescueForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRescueForm(false)}>Отмена</Button>
            <Button onClick={handleRescueCreate} loading={rescueSaving} disabled={!rescueForm.topic.trim()}>
              Отправить запрос
            </Button>
          </>
        }
      >
        <p className={styles.modalNote}>Укажите тему — другие команды увидят запрос и смогут откликнуться.</p>
        <div className={styles.form}>
          <Input label="Тема" value={rescueForm.topic} onChange={(e) => setRescueForm({ ...rescueForm, topic: e.target.value })} placeholder="Теормех — кинематика" />
          <Textarea label="Описание" value={rescueForm.description} onChange={(e) => setRescueForm({ ...rescueForm, description: e.target.value })} placeholder="В чём конкретно нужна помощь..." />
        </div>
      </Modal>
    </div>
  );
}

