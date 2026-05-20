import { useEffect, useState } from 'react';
import { eventsApi } from '@/api';
import type { CalendarEvent, EventFormat } from '@/types';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner, Textarea } from '@/components/ui';
import styles from './EventsPage.module.css';

const FORMAT_LABEL: Record<EventFormat, string> = {
  online: '🌐 Онлайн',
  offline: '📌 Офлайн',
};

export function EventsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    format: 'online' as EventFormat,
    date: '',
    location: '',
    onlineLink: '',
  });

  useEffect(() => {
    eventsApi.list().then(setEvents).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        format: form.format,
        date: form.date,
        location: form.format === 'offline' ? form.location : undefined,
        onlineLink: form.format === 'online' ? form.onlineLink : undefined,
        invitedTeamIds: [],
      };

      const created = await eventsApi.create(payload);
      setEvents((prev) => [...prev, created]);
      setShowCreate(false);
      setForm({ title: '', description: '', format: 'online', date: '', location: '', onlineLink: '' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <PageHeader
        eyebrow="Календарь"
        title="События"
        subtitle="Встречи, воркшопы и мероприятия от команд и организаторов."
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Создать событие</Button>}
      />

      {events.length === 0 && <Empty icon="📅" message="Нет запланированных событий" />}

      <div className={styles.list}>
        {sorted.map((item) => {
          const eventDate = new Date(item.date);
          return (
            <Card key={item.id} padding="md" className={styles.eventCard}>
              <div className={styles.dateBadge}>
                <span className={styles.dateDay}>{eventDate.getDate()}</span>
                <span className={styles.dateMon}>{eventDate.toLocaleDateString('ru-RU', { month: 'short' })}</span>
              </div>

              <div className={styles.eventBody}>
                <div className={styles.eventTop}>
                  <h3 className={styles.eventTitle}>{item.title}</h3>
                  <Badge variant={item.format === 'online' ? 'accent' : 'violet'}>{FORMAT_LABEL[item.format]}</Badge>
                </div>

                {item.description && <p className={styles.eventDesc}>{item.description}</p>}

                <div className={styles.eventMeta}>
                  <span>🕐 {eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  {item.location && <span>📌 {item.location}</span>}
                  <span>Организатор: {item.organizerName}</span>
                </div>

                {item.format === 'online' && item.onlineLink && (
                  <a className={styles.link} href={item.onlineLink} target="_blank" rel="noreferrer">
                    Ссылка на подключение
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        title="Создать событие"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              loading={saving}
              disabled={!form.title || !form.date || (form.format === 'online' && !form.onlineLink.trim())}
            >
              Создать
            </Button>
          </>
        )}
      >
        <div className={styles.createForm}>
          <Input label="Название" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Воркшоп по Java" />
          <Textarea label="Описание (необязательно)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Input label="Дата и время" type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />

          <div className={styles.formatRow}>
            <label className={styles.formatLabel}>Формат</label>
            <div className={styles.formatBtns}>
              {(['online', 'offline'] as const).map((format) => (
                <button
                  key={format}
                  className={[styles.fmtBtn, form.format === format ? styles.fmtActive : ''].join(' ')}
                  onClick={() => setForm({ ...form, format })}
                >
                  {FORMAT_LABEL[format]}
                </button>
              ))}
            </div>
          </div>

          {form.format === 'offline' && (
            <Input
              label="Место"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Корпус 2, ауд. 310"
            />
          )}

          {form.format === 'online' && (
            <Input
              label="Ссылка на подключение"
              value={form.onlineLink}
              onChange={(event) => setForm({ ...form, onlineLink: event.target.value })}
              placeholder="https://..."
              hint="Добавьте ссылку на платформу (Телемост / Google Meet / Zoom и т.д.), чтобы участники могли сразу подключиться"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
