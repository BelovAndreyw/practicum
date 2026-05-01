import { useEffect, useState } from 'react';
import { checkinApi, rescueApi, votingApi, teamsApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { CheckIn, RescueRequest, VoteRound, TeamMember } from '@/types';
import { Card, Badge, Button, PageHeader, Modal, Input, Textarea, Avatar, Spinner, Empty } from '@/components/ui';
import styles from './ToolsPage.module.css';

type Tab = 'checkin' | 'rescue' | 'voting';

const STATUS_LABEL: Record<string, string> = {
  pending: 'РћР¶РёРґР°РµС‚', accepted: 'РџСЂРёРЅСЏС‚Рѕ', confirmed: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ', rejected: 'РћС‚РєР»РѕРЅРµРЅРѕ',
};
const STATUS_VAR: Record<string, 'default' | 'accent' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning', accepted: 'accent', confirmed: 'success', rejected: 'danger',
};

export function ToolsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('checkin');

  // Check-in state
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [showCiForm, setShowCiForm] = useState(false);
  const [ciForm, setCiForm] = useState({ weekLabel: '', summary: '', achievements: '', blockers: '' });
  const [ciSaving, setCiSaving] = useState(false);
  const [ciSuccess, setCiSuccess] = useState(false);

  // Rescue state
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [showRescueForm, setShowRescueForm] = useState(false);
  const [rescueForm, setRescueForm] = useState({ topic: '', description: '' });
  const [rescueSaving, setRescueSaving] = useState(false);

  // Voting state
  const [round, setRound] = useState<VoteRound | null | undefined>(undefined);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [voteSaving, setVoteSaving] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.teamId) { setLoading(false); return; }
    Promise.all([
      checkinApi.list(user.teamId),
      rescueApi.list(),
      votingApi.getActiveRound(user.teamId),
      teamsApi.getTeam(user.teamId),
    ]).then(([ci, rs, vr, team]) => {
      setCheckins(ci);
      setRescues(rs);
      setRound(vr);
      setMembers(team.members.filter((m) => m.userId !== user.id));
    }).finally(() => setLoading(false));
  }, [user]);

  // Check-in handlers
  const handleCiSubmit = async () => {
    if (!user?.teamId) return;
    setCiSaving(true);
    try {
      const ci = await checkinApi.submit({ teamId: user.teamId, ...ciForm });
      setCheckins((prev) => [ci, ...prev]);
      setShowCiForm(false);
      setCiSuccess(true);
      setCiForm({ weekLabel: '', summary: '', achievements: '', blockers: '' });
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
    const r = await rescueApi.updateStatus(id, 'confirmed');
    setRescues((prev) => prev.map((x) => (x.id === id ? r : x)));
  };

  // Voting handlers
  const handleScore = (userId: string, score: number) =>
    setScores((prev) => ({ ...prev, [userId]: score }));

  const handleVoteSubmit = async () => {
    if (!round) return;
    setVoteSaving(true);
    try {
      await Promise.all(
        members.map((m) =>
          votingApi.submitBallot({ roundId: round.id, targetUserId: m.userId, score: scores[m.userId] ?? 3 }),
        ),
      );
      setVoteSubmitted(true);
    } finally { setVoteSaving(false); }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="РљРѕРјР°РЅРґРЅС‹Рµ РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹"
        title="РРЅСЃС‚СЂСѓРјРµРЅС‚С‹"
        subtitle="Р•Р¶РµРЅРµРґРµР»СЊРЅС‹Рµ РѕС‚С‡С‘С‚С‹, Р·Р°РїСЂРѕСЃС‹ РїРѕРјРѕС‰Рё Рё РѕС†РµРЅРёРІР°РЅРёРµ РІРєР»Р°РґР° СѓС‡Р°СЃС‚РЅРёРєРѕРІ."
      />

      <div className={styles.tabBar}>
        {([
          ['checkin', 'вњ…', 'Check-in'],
          ['rescue',  'рџ†', 'РЎРїР°СЃРµРЅРёРµ'],
          ['voting',  'рџ—іпёЏ', 'Р“РѕР»РѕСЃРѕРІР°РЅРёРµ'],
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

      {/* в”Ђв”Ђ CHECK-IN в”Ђв”Ђ */}
      {tab === 'checkin' && (
        <div className={styles.twoCol}>
          {/* Р¤РѕСЂРјР° / РєРЅРѕРїРєР° */}
          <div className={styles.colLeft}>
            {ciSuccess && (
              <div className={styles.successBanner}>вњ… Check-in РѕС‚РїСЂР°РІР»РµРЅ РѕСЂРіР°РЅРёР·Р°С‚РѕСЂР°Рј!</div>
            )}
            {!showCiForm ? (
              <Card padding="lg" className={styles.actionCard}>
                <span className={styles.actionIcon}>вњ…</span>
                <h3 className={styles.actionTitle}>РћС‚РїСЂР°РІРёС‚СЊ РµР¶РµРЅРµРґРµР»СЊРЅС‹Р№ РѕС‚С‡С‘С‚</h3>
                <p className={styles.actionDesc}>
                  Р Р°СЃСЃРєР°Р¶РёС‚Рµ РѕСЂРіР°РЅРёР·Р°С‚РѕСЂР°Рј, С‡С‚Рѕ РєРѕРјР°РЅРґР° СЃРґРµР»Р°Р»Р° Р·Р° РЅРµРґРµР»СЋ, С‡РµРіРѕ РґРѕСЃС‚РёРіР»Р° Рё С‡С‚Рѕ РјРµС€Р°РµС‚ РґРІРёРіР°С‚СЊСЃСЏ РІРїРµСЂС‘Рґ.
                </p>
                <Button onClick={() => { setShowCiForm(true); setCiSuccess(false); }}>
                  РќРѕРІС‹Р№ check-in
                </Button>
              </Card>
            ) : (
              <Card padding="lg">
                <h3 className={styles.formTitle}>РќРѕРІС‹Р№ Check-in</h3>
                <div className={styles.form}>
                  <Input label="РќРµРґРµР»СЏ" value={ciForm.weekLabel} onChange={(e) => setCiForm({ ...ciForm, weekLabel: e.target.value })} placeholder="РќРµРґРµР»СЏ 3" />
                  <Textarea label="Р§С‚Рѕ СЃРґРµР»Р°Р»Рё?" value={ciForm.summary} onChange={(e) => setCiForm({ ...ciForm, summary: e.target.value })} placeholder="РљСЂР°С‚РєРѕ Рѕ СЂРµР·СѓР»СЊС‚Р°С‚Р°С…..." />
                  <Textarea label="Р”РѕСЃС‚РёР¶РµРЅРёСЏ" value={ciForm.achievements} onChange={(e) => setCiForm({ ...ciForm, achievements: e.target.value })} placeholder="Р—Р°РІРµСЂС€РёР»Рё С‡РµР»Р»РµРЅРґР¶, РІРѕСЂРєС€РѕРї..." />
                  <Textarea label="Р‘Р»РѕРєРµСЂС‹ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)" value={ciForm.blockers} onChange={(e) => setCiForm({ ...ciForm, blockers: e.target.value })} placeholder="РўСЂСѓРґРЅРѕСЃС‚Рё, РЅРµС…РІР°С‚РєР° РІСЂРµРјРµРЅРё..." />
                  <div className={styles.formBtns}>
                    <Button onClick={handleCiSubmit} loading={ciSaving} disabled={!ciForm.weekLabel || !ciForm.summary}>РћС‚РїСЂР°РІРёС‚СЊ</Button>
                    <Button variant="ghost" onClick={() => setShowCiForm(false)}>РћС‚РјРµРЅР°</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* РСЃС‚РѕСЂРёСЏ */}
          <div className={styles.colRight}>
            <h3 className={styles.histTitle}>РСЃС‚РѕСЂРёСЏ check-in</h3>
            {checkins.length === 0
              ? <Empty icon="рџ“‹" message="Р•С‰С‘ РЅРµ Р±С‹Р»Рѕ check-in" hint="РћС‚РїСЂР°РІСЊС‚Рµ РїРµСЂРІС‹Р№ РѕС‚С‡С‘С‚" />
              : checkins.map((ci) => (
                <Card key={ci.id} padding="md" className={styles.ciItem}>
                  <div className={styles.ciHead}>
                    <Badge variant="accent">{ci.weekLabel}</Badge>
                    <span className={styles.ciDate}>{new Date(ci.submittedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <p className={styles.ciField}><strong>РС‚РѕРіРё:</strong> {ci.summary}</p>
                  <p className={styles.ciField}><strong>Р”РѕСЃС‚РёР¶РµРЅРёСЏ:</strong> {ci.achievements}</p>
                  {ci.blockers && <p className={styles.ciField}><strong>Р‘Р»РѕРєРµСЂС‹:</strong> {ci.blockers}</p>}
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* в”Ђв”Ђ RESCUE в”Ђв”Ђ */}
      {tab === 'rescue' && (
        <div className={styles.twoCol}>
          <div className={styles.colLeft}>
            <Card padding="lg" className={styles.actionCard}>
              <span className={styles.actionIcon}>рџ†</span>
              <h3 className={styles.actionTitle}>Р—Р°РїСЂРѕСЃРёС‚СЊ РїРѕРјРѕС‰СЊ</h3>
              <p className={styles.actionDesc}>
                Р Р°Р·РјРµСЃС‚РёС‚Рµ Р·Р°СЏРІРєСѓ вЂ” РґСЂСѓРіР°СЏ РєРѕРјР°РЅРґР° РѕС‚РєР»РёРєРЅРµС‚СЃСЏ Рё РїРѕРјРѕР¶РµС‚ СЂР°Р·РѕР±СЂР°С‚СЊСЃСЏ СЃ С‚РµРјРѕР№.
                РћР±Рµ РєРѕРјР°РЅРґС‹ РїРѕР»СѓС‡Р°С‚ Р±РѕРЅСѓСЃРЅС‹Рµ Р±Р°Р»Р»С‹ РїРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.
              </p>
              <Button onClick={() => setShowRescueForm(true)}>Р—Р°РїСЂРѕСЃРёС‚СЊ СЃРїР°СЃРµРЅРёРµ</Button>
            </Card>
          </div>

          <div className={styles.colRight}>
            <h3 className={styles.histTitle}>Р—Р°СЏРІРєРё РЅР° СЃРїР°СЃРµРЅРёРµ</h3>
            {rescues.length === 0
              ? <Empty icon="рџ†" message="РќРµС‚ Р·Р°СЏРІРѕРє" hint="РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ Р·Р°СЏРІРєСѓ РЅР° РїРѕРјРѕС‰СЊ" />
              : rescues.map((r) => (
                <Card key={r.id} padding="md" className={styles.rescueItem}>
                  <div className={styles.rescueHead}>
                    <Badge variant={STATUS_VAR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    <span className={styles.rescueBonus}>+{r.bonusPoints} pts</span>
                  </div>
                  <h4 className={styles.rescueTopic}>{r.topic}</h4>
                  <p className={styles.rescueDesc}>{r.description}</p>
                  <div className={styles.rescueMeta}>
                    <span>РћС‚: {r.requesterTeamName}</span>
                    {r.helperTeamName && <span>в†’ {r.helperTeamName}</span>}
                  </div>
                  {r.status === 'pending' && user?.teamId && r.requesterTeamId !== user.teamId && (
                    <Button size="sm" variant="secondary" onClick={() => handleAccept(r.id)} style={{ marginTop: 10 }}>РџРѕРјРѕС‡СЊ</Button>
                  )}
                  {r.status === 'accepted' && (
                    <Button size="sm" onClick={() => handleConfirm(r.id)} style={{ marginTop: 10 }}>вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ</Button>
                  )}
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* в”Ђв”Ђ VOTING в”Ђв”Ђ */}
      {tab === 'voting' && (
        <div className={styles.votingWrap}>
          {round === null && (
            <Empty icon="рџ—іпёЏ" message="РќРµС‚ Р°РєС‚РёРІРЅРѕРіРѕ СЂР°СѓРЅРґР°" hint="РћСЂРіР°РЅРёР·Р°С‚РѕСЂС‹ РѕС‚РєСЂРѕСЋС‚ РіРѕР»РѕСЃРѕРІР°РЅРёРµ РІ РєРѕРЅС†Рµ С†РёРєР»Р°." />
          )}
          {round && voteSubmitted && (
            <Card padding="lg" className={styles.voteSuccess}>
              <span className={styles.voteSuccessIcon}>рџЋ‰</span>
              <h2>Р“РѕР»РѕСЃР° СѓС‡С‚РµРЅС‹!</h2>
              <p className={styles.voteSuccessDesc}>Р’Р°С€Рё РѕС†РµРЅРєРё РѕС‚РїСЂР°РІР»РµРЅС‹ Р°РЅРѕРЅРёРјРЅРѕ Рё Р±СѓРґСѓС‚ СѓС‡С‚РµРЅС‹ РїСЂРё СЂР°СЃС‡С‘С‚Рµ СЂРµР№С‚РёРЅРіР° СѓС‡Р°СЃС‚РЅРёРєРѕРІ.</p>
            </Card>
          )}
          {round && !voteSubmitted && (
            <>
              <div className={styles.roundInfo}>
                <Badge variant="accent">{round.cycleLabel}</Badge>
                <span className={styles.roundClose}>Р—Р°РєСЂС‹РІР°РµС‚СЃСЏ: {new Date(round.closesAt).toLocaleDateString('ru-RU')}</span>
                <p className={styles.roundHint}>РћС†РµРЅРёС‚Рµ РІРєР»Р°Рґ РєР°Р¶РґРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР° РІР°С€РµР№ РєРѕРјР°РЅРґС‹ РїРѕ 5-Р±Р°Р»Р»СЊРЅРѕР№ С€РєР°Р»Рµ. Р“РѕР»РѕСЃР° Р°РЅРѕРЅРёРјРЅС‹.</p>
              </div>
              <div className={styles.membersGrid}>
                {members.map((m) => (
                  <Card key={m.userId} padding="md" className={styles.memberCard}>
                    <div className={styles.memberInfo}>
                      <Avatar name={`${m.firstName} ${m.lastName}`} src={m.avatarUrl} size="lg" />
                      <p className={styles.memberName}>{m.firstName} {m.lastName}</p>
                      <p className={styles.memberRole}>{m.role === 'captain' ? 'РљР°РїРёС‚Р°РЅ' : 'РЈС‡Р°СЃС‚РЅРёРє'}</p>
                    </div>
                    <div className={styles.stars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          className={[styles.star, (scores[m.userId] ?? 0) >= s ? styles.starActive : ''].join(' ')}
                          onClick={() => handleScore(m.userId, s)}
                        >в…</button>
                      ))}
                    </div>
                    <span className={styles.scoreLabel}>
                      {scores[m.userId] ? `${scores[m.userId]} / 5` : 'РЅРµ РѕС†РµРЅРµРЅ'}
                    </span>
                  </Card>
                ))}
              </div>
              <div className={styles.submitRow}>
                <Button size="lg" onClick={handleVoteSubmit} loading={voteSaving} disabled={members.some((m) => !scores[m.userId])}>
                  РћС‚РїСЂР°РІРёС‚СЊ РѕС†РµРЅРєРё
                </Button>
                {members.some((m) => !scores[m.userId]) && (
                  <p className={styles.submitHint}>РћС†РµРЅРёС‚Рµ РІСЃРµС… СѓС‡Р°СЃС‚РЅРёРєРѕРІ</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rescue modal */}
      <Modal
        title="Р—Р°РїСЂРѕСЃ РЅР° СЃРїР°СЃРµРЅРёРµ"
        open={showRescueForm}
        onClose={() => setShowRescueForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRescueForm(false)}>РћС‚РјРµРЅР°</Button>
            <Button onClick={handleRescueCreate} loading={rescueSaving} disabled={!rescueForm.topic.trim()}>
              РћС‚РїСЂР°РІРёС‚СЊ Р·Р°РїСЂРѕСЃ
            </Button>
          </>
        }
      >
        <p className={styles.modalNote}>РЈРєР°Р¶РёС‚Рµ С‚РµРјСѓ вЂ” РґСЂСѓРіРёРµ РєРѕРјР°РЅРґС‹ СѓРІРёРґСЏС‚ Р·Р°РїСЂРѕСЃ Рё СЃРјРѕРіСѓС‚ РѕС‚РєР»РёРєРЅСѓС‚СЊСЃСЏ.</p>
        <div className={styles.form}>
          <Input label="РўРµРјР°" value={rescueForm.topic} onChange={(e) => setRescueForm({ ...rescueForm, topic: e.target.value })} placeholder="РўРµРѕСЂРјРµС… вЂ” РєРёРЅРµРјР°С‚РёРєР°" />
          <Textarea label="РћРїРёСЃР°РЅРёРµ" value={rescueForm.description} onChange={(e) => setRescueForm({ ...rescueForm, description: e.target.value })} placeholder="Р’ С‡С‘Рј РєРѕРЅРєСЂРµС‚РЅРѕ РЅСѓР¶РЅР° РїРѕРјРѕС‰СЊ..." />
        </div>
      </Modal>
    </div>
  );
}

