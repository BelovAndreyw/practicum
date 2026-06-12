import { useEffect, useState } from 'react';
import { checkinApi } from '@/api';
import type { CheckIn } from '@/types';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, Button, PageHeader, Input, Textarea, Spinner, Empty, Badge } from '@/components/ui';
import styles from './CheckInPage.module.css';

export function CheckInPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weekLabel: '', summary: '', achievements: '', blockers: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user?.teamId) { setLoading(false); return; }
    checkinApi.list(user.teamId).then(setHistory).finally(() => setLoading(false));
  }, [user]);

  const handleSubmit = async () => {
    if (!user?.teamId) return;
    setSaving(true);
    try {
      const ci = await checkinApi.submit({ teamId: user.teamId, ...form });
      setHistory((prev) => [ci, ...prev]);
      setShowForm(false);
      setSuccess(true);
      setForm({ weekLabel: '', summary: '', achievements: '', blockers: '' });
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось отправить check-in');
    } finally { setSaving(false); }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        eyebrow="Отчётность"
        title="Командный Check-in"
        subtitle="Еженедельный краткий отчёт команды для организаторов."
        actions={!showForm && <Button size="sm" onClick={() => { setShowForm(true); setSuccess(false); }}>+ Новый check-in</Button>}
      />

      {success && (
        <div className={styles.successBanner}>
          ✅ Check-in успешно отправлен организаторам!
        </div>
      )}

      {showForm && (
        <Card padding="lg" className={styles.formCard}>
          <h3 className={styles.formTitle}>Новый Check-in</h3>
          <div className={styles.form}>
            <Input label="Неделя" value={form.weekLabel} onChange={(e) => setForm({ ...form, weekLabel: e.target.value })} placeholder="Неделя 3" />
            <Textarea label="Что сделали за неделю?" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Кратко опишите результаты..." />
            <Textarea label="Достижения и завершённые задачи" value={form.achievements} onChange={(e) => setForm({ ...form, achievements: e.target.value })} placeholder="Завершили челлендж, провели воркшоп..." />
            <Textarea label="Что мешает? (необязательно)" value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} placeholder="Трудности с расписанием, нет понимания темы..." />
            <div className={styles.formBtns}>
              <Button onClick={handleSubmit} loading={saving} disabled={!form.weekLabel || !form.summary}>Отправить</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Отмена</Button>
            </div>
          </div>
        </Card>
      )}

      <h3 className={styles.histTitle}>История check-in</h3>
      {history.length === 0 && <Empty icon="✅" message="Ещё не было check-in" hint="Отправьте первый отчёт организаторам" />}
      <div className={styles.list}>
        {history.map((ci) => (
          <Card key={ci.id} padding="md">
            <div className={styles.ciHead}>
              <Badge variant="accent">{ci.weekLabel}</Badge>
              <span className={styles.ciDate}>{new Date(ci.submittedAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <p className={styles.ciField}><strong>Итоги:</strong> {ci.summary}</p>
            <p className={styles.ciField}><strong>Достижения:</strong> {ci.achievements}</p>
            {ci.blockers && <p className={styles.ciField}><strong>Блокеры:</strong> {ci.blockers}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
