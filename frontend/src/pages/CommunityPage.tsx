import { useEffect, useState } from 'react';
import { newsApi, knowledgeApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { NewsItem, KnowledgeRequest, KnowledgeRequestType } from '@/types';
import { Card, Badge, Button, PageHeader, Modal, Input, Textarea, Spinner, Empty } from '@/components/ui';
import styles from './CommunityPage.module.css';

type Tab = 'news' | 'knowledge';

export function CommunityPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'need' as KnowledgeRequestType, title: '', description: '', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.allSettled([newsApi.list(), knowledgeApi.list({ resolved: false })])
      .then(([n, k]) => {
        if (n.status === 'fulfilled') setNews(n.value);
        if (k.status === 'fulfilled') setKnowledge(k.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const k = await knowledgeApi.create({
        ...form,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setKnowledge((prev) => [k, ...prev]);
      setShowForm(false);
      setForm({ type: 'need', title: '', description: '', tags: '' });
    } finally { setSaving(false); }
  };

  const handleResolve = async (id: string) => {
    await knowledgeApi.resolve(id);
    setKnowledge((prev) => prev.filter((k) => k.id !== id));
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <PageHeader
          eyebrow="РРЅС„РѕСЂРјР°С†РёСЏ"
          title="РЎРѕРѕР±С‰РµСЃС‚РІРѕ"
          subtitle="РќРѕРІРѕСЃС‚Рё РѕС‚ РѕСЂРіР°РЅРёР·Р°С‚РѕСЂРѕРІ Рё Р±РёСЂР¶Р° Р·РЅР°РЅРёР№ РјРµР¶РґСѓ РєРѕРјР°РЅРґР°РјРё."
        />
        {tab === 'knowledge' && (
          <Button size="sm" onClick={() => setShowForm(true)}>+ Р Р°Р·РјРµСЃС‚РёС‚СЊ</Button>
        )}
      </div>

      <div className={styles.tabBar}>
        <button
          className={[styles.tabBtn, tab === 'news' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('news')}
        >
          рџ“° РќРѕРІРѕСЃС‚Рё
        </button>
        <button
          className={[styles.tabBtn, tab === 'knowledge' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('knowledge')}
        >
          рџ’Ў Р‘РёСЂР¶Р° Р·РЅР°РЅРёР№
        </button>
      </div>

      {tab === 'news' && (
        <div className={styles.newsGrid}>
          {news.length === 0 && <Empty icon="рџ“°" message="РќРѕРІРѕСЃС‚РµР№ РїРѕРєР° РЅРµС‚" />}
          {news.map((n) => (
            <Card key={n.id} padding="lg" className={styles.newsCard}>
              <p className={styles.newsDate}>
                {new Date(n.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' В· '}{n.authorName}
              </p>
              <h2 className={styles.newsTitle}>{n.title}</h2>
              <p className={styles.newsBody}>{n.body}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'knowledge' && (
        <>
          <div className={styles.knFilter}>
            <span className={styles.knLabel}>РћС‚РєСЂС‹С‚С‹Рµ Р·Р°РїСЂРѕСЃС‹ Рё РїСЂРµРґР»РѕР¶РµРЅРёСЏ</span>
          </div>
          {knowledge.length === 0 && (
            <Empty icon="рџ’Ў" message="РџСѓСЃС‚Рѕ" hint="Р Р°Р·РјРµСЃС‚РёС‚Рµ РїРµСЂРІС‹Р№ Р·Р°РїСЂРѕСЃ РёР»Рё РїСЂРµРґР»РѕР¶РµРЅРёРµ!" />
          )}
          <div className={styles.knGrid}>
            {knowledge.map((k) => (
              <Card key={k.id} padding="md" className={styles.knCard}>
                <div className={styles.knHead}>
                  <Badge variant={k.type === 'need' ? 'accent' : 'success'}>
                    {k.type === 'need' ? 'рџ™‹ РС‰РµРј' : 'рџ’Ў РџСЂРµРґР»Р°РіР°РµРј'}
                  </Badge>
                  <span className={styles.knTime}>{new Date(k.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                <h3 className={styles.knTitle}>{k.title}</h3>
                {k.description && <p className={styles.knDesc}>{k.description}</p>}
                {k.tags.length > 0 && (
                  <div className={styles.knTags}>
                    {k.tags.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
                  </div>
                )}
                <div className={styles.knFoot}>
                  <span className={styles.knAuthor}>{k.teamName ?? k.authorName}</span>
                  {(k.authorId === user?.id || (!!user?.teamId && k.teamId === user.teamId)) && (
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(k.id)}>вњ“ Р—Р°РєСЂС‹С‚СЊ</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

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
                <button
                  key={t}
                  className={[styles.typeBtn, form.type === t ? styles.typeActive : ''].join(' ')}
                  onClick={() => setForm({ ...form, type: t })}
                >
                  {t === 'need' ? 'рџ™‹ Р—Р°РїСЂРѕСЃ РїРѕРјРѕС‰Рё' : 'рџ’Ў РџСЂРµРґР»РѕР¶РµРЅРёРµ'}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Р—Р°РіРѕР»РѕРІРѕРє"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={form.type === 'need' ? 'РС‰РµРј СЌРєСЃРїРµСЂС‚Р° РїРѕ Java' : 'РџСЂРѕРІРµРґС‘Рј СЂР°Р·Р±РѕСЂ РїРѕ С„РёР·РёРєРµ'}
          />
          <Textarea
            label="РћРїРёСЃР°РЅРёРµ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="РўРµРіРё (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="Java, РћРћРџ, Spring..."
          />
        </div>
      </Modal>
    </div>
  );
}

