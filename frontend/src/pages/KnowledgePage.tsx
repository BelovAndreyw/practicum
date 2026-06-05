import { useEffect, useState } from 'react';
import { knowledgeApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { KnowledgeRequest, KnowledgeRequestType } from '@/types';
import { Card, Badge, Button, PageHeader, Modal, Input, Textarea, Tabs, Spinner, Empty } from '@/components/ui';
import styles from './KnowledgePage.module.css';

const TABS = [
  { id: 'all',   label: 'Р’СЃРµ' },
  { id: 'need',  label: 'рџ™‹ Р—Р°РїСЂРѕСЃС‹' },
  { id: 'offer', label: 'рџ’Ў РџСЂРµРґР»РѕР¶РµРЅРёСЏ' },
];

export function KnowledgePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<KnowledgeRequest[]>([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'need' as KnowledgeRequestType, title: '', description: '', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { knowledgeApi.list({ resolved: false }).then(setItems).finally(() => setLoading(false)); }, []);

  const filtered = items.filter((k) => tab === 'all' || k.type === tab);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const k = await knowledgeApi.create({ ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean) });
      setItems((prev) => [k, ...prev]);
      setShowForm(false);
      setForm({ type: 'need', title: '', description: '', tags: '' });
    } finally { setSaving(false); }
  };

  const handleResolve = async (id: string) => {
    await knowledgeApi.resolve(id);
    setItems((prev) => prev.filter((k) => k.id !== id));
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        eyebrow="РћР±РјРµРЅ Р·РЅР°РЅРёСЏРјРё"
        title="Р‘РёСЂР¶Р° Р·РЅР°РЅРёР№"
        subtitle="Р Р°Р·РјРµС‰Р°Р№С‚Рµ Р·Р°РїСЂРѕСЃС‹ РЅР° РїРѕРјРѕС‰СЊ РёР»Рё РїСЂРµРґР»Р°РіР°Р№С‚Рµ СЃРІРѕСЋ СЌРєСЃРїРµСЂС‚РёР·Сѓ РґСЂСѓРіРёРј РєРѕРјР°РЅРґР°Рј."
        actions={<Button size="sm" onClick={() => setShowForm(true)}>+ Р Р°Р·РјРµСЃС‚РёС‚СЊ</Button>}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className={styles.grid}>
        {filtered.length === 0 && <Empty icon="рџ’Ў" message="РџСѓСЃС‚Рѕ" hint="Р‘СѓРґСЊС‚Рµ РїРµСЂРІС‹Рј вЂ” СЂР°Р·РјРµСЃС‚РёС‚Рµ Р·Р°РїСЂРѕСЃ РёР»Рё РїСЂРµРґР»РѕР¶РµРЅРёРµ!" />}
        {filtered.map((k) => (
          <Card key={k.id} padding="md" className={styles.card}>
            <div className={styles.cardHead}>
              <Badge variant={k.type === 'need' ? 'accent' : 'success'}>
                {k.type === 'need' ? 'рџ™‹ РС‰РµРј' : 'рџ’Ў РџСЂРµРґР»Р°РіР°РµРј'}
              </Badge>
              <span className={styles.time}>{new Date(k.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <h3 className={styles.title}>{k.title}</h3>
            {k.description && <p className={styles.desc}>{k.description}</p>}
            {k.tags.length > 0 && (
              <div className={styles.tags}>
                {k.tags.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
              </div>
            )}
            <div className={styles.cardFoot}>
              <span className={styles.author}>{k.teamName ?? k.authorName}</span>
              {k.authorId === user?.id && (
                <Button size="sm" variant="ghost" onClick={() => handleResolve(k.id)}>вњ“ Р—Р°РєСЂС‹С‚СЊ</Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title="Р Р°Р·РјРµСЃС‚РёС‚СЊ РЅР° Р±РёСЂР¶Рµ"
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>РћС‚РјРµРЅР°</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.title.trim()}>Р Р°Р·РјРµСЃС‚РёС‚СЊ</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.typeRow}>
            <label className={styles.typeLabel}>РўРёРї</label>
            <div className={styles.typeBtns}>
              {(['need', 'offer'] as const).map((t) => (
                <button key={t} className={[styles.typeBtn, form.type === t ? styles.typeActive : ''].join(' ')} onClick={() => setForm({ ...form, type: t })}>
                  {t === 'need' ? 'рџ™‹ Р—Р°РїСЂРѕСЃ РїРѕРјРѕС‰Рё' : 'рџ’Ў РџСЂРµРґР»РѕР¶РµРЅРёРµ'}
                </button>
              ))}
            </div>
          </div>
          <Input label="Р—Р°РіРѕР»РѕРІРѕРє" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.type === 'need' ? 'РС‰РµРј СЌРєСЃРїРµСЂС‚Р° РїРѕ Java' : 'РџСЂРѕРІРµРґС‘Рј СЂР°Р·Р±РѕСЂ РїРѕ С„РёР·РёРєРµ'} />
          <Textarea label="РћРїРёСЃР°РЅРёРµ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="РўРµРіРё (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Java, РћРћРџ, Spring..." />
        </div>
      </Modal>
    </div>
  );
}

