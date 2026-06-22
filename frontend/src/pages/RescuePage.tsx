import { useEffect, useState } from 'react';
import { rescueApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { RescueRequest } from '@/types';
import { Card, Badge, Button, PageHeader, Modal, Input, Textarea, Spinner, Empty } from '@/components/ui';
import styles from './RescuePage.module.css';

const STATUS_LABEL: Record<string, string> = {
  pending: 'РћР¶РёРґР°РµС‚',
  accepted: 'РџСЂРёРЅСЏС‚Рѕ',
  confirmed: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ',
  rejected: 'РћС‚РєР»РѕРЅРµРЅРѕ',
};
const STATUS_VAR: Record<string, 'default' | 'accent' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning', accepted: 'accent', confirmed: 'success', rejected: 'danger',
};

export function RescuePage() {
  const { user } = useAuth();
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ topic: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => { rescueApi.list().then(setRescues).finally(() => setLoading(false)); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const r = await rescueApi.create(form);
      setRescues((prev) => [r, ...prev]);
      setShowForm(false);
      setForm({ topic: '', description: '' });
    } finally { setSaving(false); }
  };

  const handleAccept = async (id: string) => {
    const r = await rescueApi.updateStatus(id, 'accepted');
    setRescues((prev) => prev.map((x) => x.id === id ? r : x));
  };

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    try {
      const r = await rescueApi.updateStatus(id, 'confirmed');
      setRescues((prev) => prev.map((x) => x.id === id ? r : x));
    } catch (event) {
      alert(event instanceof Error ? event.message : 'Не удалось подтвердить помощь');
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        eyebrow="Р’Р·Р°РёРјРѕРїРѕРјРѕС‰СЊ"
        title="РњРµС…Р°РЅРёРєР° В«РЎРїР°СЃРµРЅРёСЏВ»"
        subtitle="РџРѕРїСЂРѕСЃРёС‚Рµ РїРѕРјРѕС‰Рё Сѓ РґСЂСѓРіРѕР№ РєРѕРјР°РЅРґС‹ РёР»Рё РѕС‚РєР»РёРєРЅРёС‚РµСЃСЊ РЅР° С‡СѓР¶РѕР№ Р·Р°РїСЂРѕСЃ. РџРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РѕР±Рµ РєРѕРјР°РЅРґС‹ РїРѕР»СѓС‡Р°СЋС‚ Р±РѕРЅСѓСЃРЅС‹Рµ Р±Р°Р»Р»С‹."
        actions={<Button size="sm" onClick={() => setShowForm(true)}>рџ† Р—Р°РїСЂРѕСЃРёС‚СЊ РїРѕРјРѕС‰СЊ</Button>}
      />

      {rescues.length === 0 && <Empty icon="рџ†" message="Р—Р°РїСЂРѕСЃРѕРІ СЃРїР°СЃРµРЅРёСЏ РїРѕРєР° РЅРµС‚" hint="РќР°Р¶РјРёС‚Рµ В«Р—Р°РїСЂРѕСЃРёС‚СЊ РїРѕРјРѕС‰СЊВ», С‡С‚РѕР±С‹ СЂР°Р·РјРµСЃС‚РёС‚СЊ Р·Р°СЏРІРєСѓ" />}

      <div className={styles.list}>
        {rescues.map((r) => (
          <Card key={r.id} padding="md" className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <Badge variant={STATUS_VAR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                <h3 className={styles.topic}>{r.topic}</h3>
              </div>
              <div className={styles.bonus}>+{r.bonusPoints} pts</div>
            </div>
            <p className={styles.desc}>{r.description}</p>
            <div className={styles.meta}>
              <span>РћС‚: {r.requesterTeamName}</span>
              {r.helperTeamName && <span>в†’ {r.helperTeamName}</span>}
              {r.confirmedAt && <span>вњ… {new Date(r.confirmedAt).toLocaleDateString('ru-RU')}</span>}
            </div>
            {r.status === 'pending' && user?.teamId && r.requesterTeamId !== user.teamId && (
              <Button size="sm" variant="secondary" onClick={() => handleAccept(r.id)} style={{ marginTop: 12 }}>
                РџРѕРјРѕС‡СЊ
              </Button>
            )}
            {r.status === 'accepted' && user?.teamId === r.requesterTeamId && (
              <Button
                size="sm"
                onClick={() => handleConfirm(r.id)}
                loading={confirmingId === r.id}
                style={{ marginTop: 12 }}
              >
                ✅ Подтвердить завершение
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Modal
        title="Р—Р°РїСЂРѕСЃ РЅР° СЃРїР°СЃРµРЅРёРµ"
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>РћС‚РјРµРЅР°</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.topic.trim()}>РћС‚РїСЂР°РІРёС‚СЊ Р·Р°РїСЂРѕСЃ</Button>
          </>
        }
      >
        <p className={styles.modalNote}>РЈРєР°Р¶РёС‚Рµ С‚РµРјСѓ Рё РѕРїРёСЃР°РЅРёРµ вЂ” РґСЂСѓРіРёРµ РєРѕРјР°РЅРґС‹ СѓРІРёРґСЏС‚ РІР°С€ Р·Р°РїСЂРѕСЃ Рё СЃРјРѕРіСѓС‚ РѕС‚РєР»РёРєРЅСѓС‚СЊСЃСЏ.</p>
        <div className={styles.formGrid}>
          <Input label="РўРµРјР°" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="РўРµРѕСЂРјРµС… вЂ” РєРёРЅРµРјР°С‚РёРєР°" />
          <Textarea label="РћРїРёСЃР°РЅРёРµ" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Р’ С‡С‘Рј РєРѕРЅРєСЂРµС‚РЅРѕ РЅСѓР¶РЅР° РїРѕРјРѕС‰СЊ..." />
        </div>
      </Modal>
    </div>
  );
}

