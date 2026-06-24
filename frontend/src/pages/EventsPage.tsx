import { type ChangeEvent, useEffect, useState } from 'react';
import { eventsApi, teamsApi } from '@/api';
import { externalMediaUrl, isApiMediaUrl } from '@/api/mappers/user';
import { useAuth } from '@/features/auth/AuthContext';
import type { CalendarEvent, EventFormat, Team } from '@/types';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner, Textarea } from '@/components/ui';
import styles from './EventsPage.module.css';
import { isPastEvent } from '@/utils/dates';

const FORMAT_LABEL: Record<EventFormat, string> = {
  online: '🌐 Онлайн',
  offline: '📌 Офлайн',
};

export function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [organizerTeams, setOrganizerTeams] = useState<Team[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    format: 'online' as EventFormat,
    date: '',
    location: '',
    onlineLink: '',
    teamId: '',
  });

  const isOrganizerWithoutTeam = user?.role === 'organizer' && !user.teamId;
  const canCreateEvent = Boolean(user && (user.teamId || user.role === 'organizer'));

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    eventsApi.list()
      .then(setEvents)
      .catch(() => setLoadError('Не удалось загрузить события'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOrganizerWithoutTeam) return;
    teamsApi.listTeams().then(setOrganizerTeams).catch(() => setOrganizerTeams([]));
  }, [isOrganizerWithoutTeam]);

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  const resetForm = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setHasUploadedImage(false);
    setForm({
      title: '',
      description: '',
      imageUrl: '',
      format: 'online',
      date: '',
      location: '',
      onlineLink: '',
      teamId: user?.teamId ?? organizerTeams[0]?.id ?? '',
    });
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    resetForm();
    setShowCreate(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setHasUploadedImage(isApiMediaUrl(event.imageUrl));
    setForm({
      title: event.title,
      description: event.description ?? '',
      imageUrl: externalMediaUrl(event.imageUrl),
      format: event.format,
      date: toDatetimeLocalValue(new Date(event.date)),
      location: event.location ?? '',
      onlineLink: event.onlineLink ?? '',
      teamId: event.invitedTeamIds[0] ?? '',
    });
    setShowCreate(true);
  };

  const closeEventModal = () => {
    setShowCreate(false);
    setEditingEvent(null);
  };

  const canEditEvent = (event: CalendarEvent) => Boolean(user && event.organizerId === user.id);
  const canDeleteEvent = (event: CalendarEvent) => Boolean(user && (event.organizerId === user.id || user.role === 'organizer'));
  const formImagePreview = imagePreviewUrl ?? (form.imageUrl || (hasUploadedImage ? editingEvent?.imageUrl : undefined));

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    event.target.value = '';
  };

  const handleRemoveUploadedImage = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      const updated = await eventsApi.removeImage(editingEvent.id);
      setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingEvent(updated);
      setHasUploadedImage(false);
      setPendingImageFile(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        imageUrl: form.imageUrl.trim() || undefined,
        format: form.format,
        date: new Date(form.date).toISOString(),
        location: form.format === 'offline' ? form.location : undefined,
        onlineLink: form.format === 'online' ? form.onlineLink : undefined,
        invitedTeamIds: [],
      };

      if (editingEvent) {
        let updated = await eventsApi.update(editingEvent.id, payload);
        if (pendingImageFile) {
          updated = await eventsApi.uploadImage(updated.id, pendingImageFile);
        }
        setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const teamId = form.teamId || user?.teamId;
        if (!teamId) return;
        let created = await eventsApi.create({
          ...payload,
          teamId,
          organizerId: user?.id,
          organizerName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : undefined,
        });
        if (pendingImageFile) {
          created = await eventsApi.uploadImage(created.id, pendingImageFile);
        }
        setEvents((prev) => [...prev, created]);
      }

      closeEventModal();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: CalendarEvent) => {
    if (!canDeleteEvent(event) || !window.confirm('Удалить событие?')) return;

    setSaving(true);
    try {
      await eventsApi.remove(event.id);
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      if (selectedEvent?.id === event.id) setSelectedEvent(null);
      if (editingEvent?.id === event.id) closeEventModal();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const createDisabled = isOrganizerWithoutTeam && organizerTeams.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Календарь"
        title="События"
        subtitle="Встречи, воркшопы и мероприятия от команд и организаторов."
        actions={canCreateEvent ? (
          <Button size="sm" onClick={openCreateModal} disabled={createDisabled}>
            + Создать событие
          </Button>
        ) : undefined}
      />

      {createDisabled && (
        <p className={styles.hint}>Нет доступных команд для создания события.</p>
      )}

      {loadError && events.length === 0 && <Empty icon="📅" message={loadError} />}
      {!loadError && events.length === 0 && <Empty icon="📅" message="Нет запланированных событий" />}

      <div className={styles.list}>
        {sorted.map((item) => {
          const eventDate = new Date(item.date);
          const past = isPastEvent(item.date);
          return (
            <Card
              key={item.id}
              padding="md"
              className={[styles.eventCard, past ? styles.eventCardPast : ''].join(' ')}
            >
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

                <div className={styles.eventActions}>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedEvent(item)}>Подробнее</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        title={editingEvent ? 'Редактировать событие' : 'Создать событие'}
        open={showCreate}
        onClose={closeEventModal}
        footer={(
          <>
            {editingEvent && canDeleteEvent(editingEvent) && (
              <Button variant="danger" onClick={() => handleDelete(editingEvent)} loading={saving}>Удалить</Button>
            )}
            <Button variant="secondary" onClick={closeEventModal}>Отмена</Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={
                !form.title
                || !form.date
                || (form.format === 'online' && !form.onlineLink.trim())
                || (isOrganizerWithoutTeam && !form.teamId)
              }
            >
              {editingEvent ? 'Сохранить' : 'Создать'}
            </Button>
          </>
        )}
      >
        <div className={styles.createForm}>
          {isOrganizerWithoutTeam && (
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Команда</span>
              <select
                className={styles.select}
                value={form.teamId}
                onChange={(event) => setForm({ ...form, teamId: event.target.value })}
              >
                <option value="">Выберите команду</option>
                {organizerTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
          )}
          <Input label="Название" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Воркшоп по Java" />
          <Textarea label="Описание (необязательно)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className={styles.imageField}>
            <span className={styles.imageLabel}>Обложка</span>
            <div className={styles.imageControls}>
              {formImagePreview ? (
                <div className={styles.imagePreview}>
                  <img src={formImagePreview} alt="" />
                </div>
              ) : (
                <div className={styles.imagePlaceholder}>Нет изображения</div>
              )}
              <label className={styles.uploadButton} htmlFor="event-image-upload">+ Загрузить</label>
              {editingEvent && (hasUploadedImage || pendingImageFile) && (
                <Button size="sm" variant="secondary" onClick={handleRemoveUploadedImage} loading={saving}>
                  Удалить загруженное
                </Button>
              )}
              <input
                id="event-image-upload"
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={handleImageUpload}
              />
            </div>
          </div>
          <Input
            label="Ссылка на изображение"
            value={form.imageUrl}
            onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
            placeholder="https://..."
            hint="Используется, если файл не загружен на сервер"
          />
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

      <Modal
        title={selectedEvent?.title ?? 'Событие'}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        footer={(
          <>
            {selectedEvent && canDeleteEvent(selectedEvent) && (
              <Button variant="danger" onClick={() => handleDelete(selectedEvent)} loading={saving}>Удалить</Button>
            )}
            {selectedEvent && canEditEvent(selectedEvent) && (
              <Button onClick={() => openEditModal(selectedEvent)}>Редактировать</Button>
            )}
            <Button variant="secondary" onClick={() => setSelectedEvent(null)}>Закрыть</Button>
          </>
        )}
      >
        {selectedEvent && (
          <div className={styles.details}>
            <div className={styles.detailsImage}>
              {selectedEvent.imageUrl ? (
                <img src={selectedEvent.imageUrl} alt="" />
              ) : (
                <div className={styles.detailsPlaceholder}>КЗ</div>
              )}
            </div>

            <div className={styles.detailsMeta}>
              <Badge variant={selectedEvent.format === 'online' ? 'accent' : 'violet'}>{FORMAT_LABEL[selectedEvent.format]}</Badge>
              <span>{new Date(selectedEvent.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <p className={styles.detailsText}>
              {selectedEvent.description || 'Подробности события появятся ближе к началу мероприятия.'}
            </p>

            <div className={styles.detailsInfo}>
              <p><strong>Организатор:</strong> {selectedEvent.organizerName}</p>
              {selectedEvent.location && <p><strong>Место:</strong> {selectedEvent.location}</p>}
              {selectedEvent.onlineLink && (
                <p>
                  <strong>Ссылка:</strong>{' '}
                  <a href={selectedEvent.onlineLink} target="_blank" rel="noreferrer">открыть подключение</a>
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function toDatetimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
