import { useEffect, useState } from 'react';
import { checkinApi, challengesApi, newsApi, reportsApi, rescueApi, votingApi, teamsApi } from '@/api';
import type { CheckIn, Challenge, NewsItem, RescueRequest, Team, VoteRound } from '@/types';
import type { ChallengeReportItem } from '@/api/endpoints/reports';
import { Card, Badge, Button, PageHeader, Tabs, Modal, Input, Textarea, Spinner } from '@/components/ui';
import styles from './AdminPage.module.css';

const TABS = [
  { id: 'checkins',   label: '✅ Check-in' },
  { id: 'challenges', label: '⚡ Челленджи' },
  { id: 'rescues',    label: '🆘 Спасения' },
  { id: 'voting',     label: '🗳️ Голосование' },
  { id: 'news',       label: '📰 Новости' },
];

function defaultVoteClosesAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminPage() {
  const [tab, setTab] = useState('checkins');
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [pendingReports, setPendingReports] = useState<ChallengeReportItem[]>([]);
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', points: '30', deadline: '', acceptsReport: false });
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [approvingReportId, setApprovingReportId] = useState<number | null>(null);
  const [rejectingReportId, setRejectingReportId] = useState<number | null>(null);
  const [openingFileKey, setOpeningFileKey] = useState<string | null>(null);

  const [showNewsForm, setShowNewsForm] = useState(false);
  const [newsForm, setNewsForm] = useState({ title: '', body: '' });
  const [savingNews, setSavingNews] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [voteTeamId, setVoteTeamId] = useState('');
  const [voteCycleLabel, setVoteCycleLabel] = useState('Цикл 1');
  const [voteClosesAt, setVoteClosesAt] = useState('');
  const [activeVoteRound, setActiveVoteRound] = useState<VoteRound | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);

  const refreshActiveVoteRound = async (teamId: string) => {
    try {
      const round = await votingApi.getActiveRound(teamId);
      setActiveVoteRound(round);
    } catch {
      setActiveVoteRound(null);
    }
  };

  useEffect(() => {
    Promise.allSettled([checkinApi.listAll(), challengesApi.list(), reportsApi.listPending(), rescueApi.list(), newsApi.list(), teamsApi.listTeams()])
      .then(([ci, ch, rp, rs, nw, tm]) => {
        if (ci.status === 'fulfilled') setCheckins(ci.value);
        if (ch.status === 'fulfilled') setChallenges(ch.value);
        if (rp.status === 'fulfilled') setPendingReports(rp.value);
        if (rs.status === 'fulfilled') setRescues(rs.value);
        if (nw.status === 'fulfilled') setNews(nw.value);
        if (tm.status === 'fulfilled') {
          setTeams(tm.value);
          if (tm.value.length > 0) setVoteTeamId(tm.value[0].id);
          setVoteClosesAt((prev) => prev || defaultVoteClosesAt());
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!voteTeamId) {
      setActiveVoteRound(null);
      return;
    }
    refreshActiveVoteRound(voteTeamId);
  }, [voteTeamId]);

  const handleApproveReport = async (reportId: number) => {
    setApprovingReportId(reportId);
    try {
      await reportsApi.approve(reportId);
      setPendingReports((prev) => prev.filter((report) => report.id !== reportId));
      const updated = await challengesApi.list();
      setChallenges(updated);
    } finally {
      setApprovingReportId(null);
    }
  };

  const handleRejectReport = async (reportId: number) => {
    setRejectingReportId(reportId);
    try {
      await reportsApi.reject(reportId);
      setPendingReports((prev) => prev.filter((report) => report.id !== reportId));
    } finally {
      setRejectingReportId(null);
    }
  };

  const handleOpenReportFile = async (reportId: number, fileId: number) => {
    const key = `${reportId}-${fileId}`;
    setOpeningFileKey(key);
    try {
      await reportsApi.openFile(reportId, fileId);
    } finally {
      setOpeningFileKey(null);
    }
  };

  const handleCreateChallenge = async () => {
    setSavingChallenge(true);
    try {
      const ch = await challengesApi.create({ ...challengeForm, points: Number(challengeForm.points), deadline: challengeForm.deadline || undefined });
      setChallenges((prev) => [...prev, ch]);
      setShowChallengeForm(false);
      setChallengeForm({ title: '', description: '', points: '30', deadline: '', acceptsReport: false });
    } finally { setSavingChallenge(false); }
  };

  const handleCreateNews = async () => {
    setSavingNews(true);
    try {
      const n = await newsApi.create(newsForm);
      setNews((prev) => [n, ...prev]);
      setShowNewsForm(false);
      setNewsForm({ title: '', body: '' });
    } finally { setSavingNews(false); }
  };

  const handleOpenVoteRound = async () => {
    if (!voteTeamId || !voteClosesAt) return;
    setVoteBusy(true);
    try {
      await votingApi.openRound({
        teamId: voteTeamId,
        cycleLabel: voteCycleLabel,
        closesAt: new Date(voteClosesAt).toISOString(),
      });
      await refreshActiveVoteRound(voteTeamId);
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось открыть раунд');
    } finally {
      setVoteBusy(false);
    }
  };

  const handleCloseVoteRound = async () => {
    if (!activeVoteRound) return;
    setVoteBusy(true);
    try {
      await votingApi.closeRound(activeVoteRound.id);
      await refreshActiveVoteRound(voteTeamId);
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось закрыть раунд');
    } finally {
      setVoteBusy(false);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader eyebrow="Панель управления" title="Организатор" subtitle="Управление игрой, просмотр отчётов и публикация контента." />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className={styles.content}>
        {tab === 'checkins' && (
          <Card padding="lg">
            <span className="eyebrow">Отчёты команд</span>
            <div className={styles.ciList}>
              {checkins.length === 0 && <p className={styles.empty}>Нет отчётов</p>}
              {checkins.map((ci) => (
                <div key={ci.id} className={styles.ciItem}>
                  <div className={styles.ciHead}>
                    <Badge variant="accent">{ci.weekLabel}</Badge>
                    <span className={styles.ciMeta}>Команда {ci.teamId} · {new Date(ci.submittedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <p className={styles.ciField}><strong>Итоги:</strong> {ci.summary}</p>
                  <p className={styles.ciField}><strong>Достижения:</strong> {ci.achievements}</p>
                  {ci.blockers && <p className={styles.ciField}><strong>Блокеры:</strong> {ci.blockers}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'challenges' && (
          <Card padding="lg">
            <div className={styles.tabHead}>
              <span className="eyebrow">Челленджи</span>
              <Button size="sm" onClick={() => setShowChallengeForm(true)}>+ Создать</Button>
            </div>
            {pendingReports.length > 0 && (
              <div className={styles.ciList} style={{ marginBottom: 24 }}>
                <span className="eyebrow">Отчёты на проверке</span>
                {pendingReports.map((report) => (
                  <div key={report.id} className={styles.ciItem}>
                    <div className={styles.ciHead}>
                      <Badge variant="warning">Челлендж #{report.challenge_id}</Badge>
                      <span className={styles.ciMeta}>Команда {report.team_id} · {new Date(report.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <p className={styles.ciField}><strong>{report.title}</strong></p>
                    {report.description && <p className={styles.ciField}>{report.description}</p>}
                    {report.files.length > 0 ? (
                      <div className={styles.fileList}>
                        <span className={styles.fileListLabel}>Прикреплённые файлы:</span>
                        {report.files.map((file) => (
                          <Button
                            key={file.id}
                            size="sm"
                            variant="secondary"
                            loading={openingFileKey === `${report.id}-${file.id}`}
                            onClick={() => handleOpenReportFile(report.id, file.id)}
                          >
                            📎 {file.filename}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.ciField}>Файлы не прикреплены</p>
                    )}
                    <div className={styles.reportActions}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRejectReport(report.id)}
                        loading={rejectingReportId === report.id}
                        disabled={approvingReportId === report.id}
                      >
                        Не зачесть
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveReport(report.id)}
                        loading={approvingReportId === report.id}
                        disabled={report.files.length === 0 || rejectingReportId === report.id}
                      >
                        Зачесть
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <table className={styles.table}>
              <thead><tr><th>Название</th><th>Очки</th><th>Срок</th><th>Статус</th><th>Выполнили</th></tr></thead>
              <tbody>
                {challenges.map((ch) => (
                  <tr key={ch.id}>
                    <td>{ch.title}</td>
                    <td>{ch.points}</td>
                    <td>{ch.deadline ? new Date(ch.deadline).toLocaleDateString('ru-RU') : '—'}</td>
                    <td><Badge variant={ch.status === 'active' ? 'success' : 'default'}>{ch.status}</Badge></td>
                    <td>{ch.completedByTeamIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'rescues' && (
          <Card padding="lg">
            <span className="eyebrow">Заявки на спасение</span>
            <table className={styles.table}>
              <thead><tr><th>Тема</th><th>Запрашивает</th><th>Помогает</th><th>Статус</th></tr></thead>
              <tbody>
                {rescues.map((r) => (
                  <tr key={r.id}>
                    <td>{r.topic}</td>
                    <td>{r.requesterTeamName}</td>
                    <td>{r.helperTeamName ?? '—'}</td>
                    <td>
                      <Badge variant={r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'default'}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'voting' && (
          <Card padding="lg">
            <span className="eyebrow">Анонимное голосование</span>
            <p className={styles.ciField} style={{ marginBottom: 16 }}>
              Откройте раунд для команды. После закрытия оценки обновят компонент «Сплоченность» в КРК участников.
            </p>
            <div className={styles.formGrid} style={{ marginBottom: 16 }}>
              <label>
                Команда
                <select
                  value={voteTeamId}
                  onChange={(e) => setVoteTeamId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px' }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <Input
                label="Название цикла"
                value={voteCycleLabel}
                onChange={(e) => setVoteCycleLabel(e.target.value)}
              />
              <Input
                label="Закрывается"
                type="datetime-local"
                value={voteClosesAt}
                onChange={(e) => setVoteClosesAt(e.target.value)}
              />
            </div>
            {activeVoteRound ? (
              <div>
                <Badge variant="accent">{activeVoteRound.cycleLabel}</Badge>
                <span style={{ marginLeft: 12 }}>
                  Активен до {new Date(activeVoteRound.closesAt).toLocaleString('ru-RU')}
                </span>
                <div style={{ marginTop: 12 }}>
                  <Button onClick={handleCloseVoteRound} loading={voteBusy} variant="danger">
                    Закрыть раунд и пересчитать КРК
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button onClick={handleOpenVoteRound} loading={voteBusy} disabled={!voteTeamId || !voteClosesAt}>
                  Открыть раунд голосования
                </Button>
                {(!voteTeamId || !voteClosesAt) && (
                  <p className={styles.ciField} style={{ marginTop: 8 }}>
                    {!voteTeamId ? 'Выберите команду' : 'Укажите дату закрытия раунда'}
                  </p>
                )}
              </>
            )}
          </Card>
        )}

        {tab === 'news' && (
          <Card padding="lg">
            <div className={styles.tabHead}>
              <span className="eyebrow">Новости</span>
              <Button size="sm" onClick={() => setShowNewsForm(true)}>+ Опубликовать</Button>
            </div>
            <div className={styles.newsList}>
              {news.map((n) => (
                <div key={n.id} className={styles.newsItem}>
                  <p className={styles.newsDate}>{new Date(n.publishedAt).toLocaleDateString('ru-RU')}</p>
                  <p className={styles.newsTitle}>{n.title}</p>
                  <p className={styles.newsBody}>{n.body}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        title="Создать челлендж"
        open={showChallengeForm}
        onClose={() => setShowChallengeForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChallengeForm(false)}>Отмена</Button>
            <Button onClick={handleCreateChallenge} loading={savingChallenge} disabled={!challengeForm.title}>Создать</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Input label="Название" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} />
          <Textarea label="Описание" value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} />
          <Input label="Баллы" type="number" value={challengeForm.points} onChange={(e) => setChallengeForm({ ...challengeForm, points: e.target.value })} />
          <Input label="Срок (необязательно)" type="datetime-local" value={challengeForm.deadline} onChange={(e) => setChallengeForm({ ...challengeForm, deadline: e.target.value })} />
        </div>
      </Modal>

      <Modal
        title="Опубликовать новость"
        open={showNewsForm}
        onClose={() => setShowNewsForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewsForm(false)}>Отмена</Button>
            <Button onClick={handleCreateNews} loading={savingNews} disabled={!newsForm.title || !newsForm.body}>Опубликовать</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Input label="Заголовок" value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} />
          <Textarea label="Текст новости" value={newsForm.body} onChange={(e) => setNewsForm({ ...newsForm, body: e.target.value })} style={{ minHeight: 140 }} />
        </div>
      </Modal>
    </div>
  );
}
