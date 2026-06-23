import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { activityApi, challengesApi, eventsApi, teamsApi, usersApi } from '@/api';
import type { ActivityEvent, CalendarEvent, Challenge, EventFormat, KrkBreakdown, Team, User } from '@/types';
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner, Textarea } from '@/components/ui';
import styles from './TeamPage.module.css';
import { isPastEvent } from '@/utils/dates';

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const EVENT_ICON: Record<string, string> = {
  achievement_unlocked: '🏅',
  challenge_completed: '⚡',
  rating_updated: '📈',
  team_joined: '👥',
  rescue_completed: '🆘',
  event_created: '📅',
  checkin_submitted: '✅',
};

interface CalendarCell {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
}

export function TeamPage() {
  const { user, refreshUser } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [krk, setKrk] = useState<KrkBreakdown | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [showTeamEventModal, setShowTeamEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    format: 'online' as EventFormat,
    date: '',
    location: '',
    onlineLink: '',
  });

  useEffect(() => {
    if (!user?.teamId) {
      setTeam(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.allSettled([
      teamsApi.getTeam(user.teamId),
      teamsApi.getKrkBreakdown(user.teamId),
      challengesApi.list(),
      eventsApi.list(),
      activityApi.getFeed(40),
    ])
      .then((results) => {
        const [teamResult, krkResult, challengesResult, eventsResult, activityResult] = results;

        if (teamResult.status !== 'fulfilled') {
          throw teamResult.reason;
        }

        const teamData = teamResult.value;
        setTeam(teamData);
        setKrk(krkResult.status === 'fulfilled' ? krkResult.value : null);
        setChallenges(
          challengesResult.status === 'fulfilled'
            ? challengesResult.value.filter((item) => item.status === 'active').slice(0, 5)
            : [],
        );
        const teamMemberIds = new Set(teamData.members.map((member) => member.userId));
        setEvents(
          eventsResult.status === 'fulfilled'
            ? eventsResult.value
              .filter((item) => item.invitedTeamIds.includes(teamData.id) || teamMemberIds.has(item.organizerId))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            : [],
        );
        setActivity(
          activityResult.status === 'fulfilled'
            ? activityResult.value.filter((item) => item.teamId === teamData.id).slice(0, 8)
            : [],
        );
      })
      .catch((event) => {
        setError(event instanceof Error ? event.message : 'Не удалось загрузить команду');
        setTeam(null);
      })
      .finally(() => setLoading(false));
  }, [user?.teamId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await teamsApi.createTeam(newName.trim());
      await refreshUser();
      setTeam(created);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const joined = await teamsApi.joinByCode(joinCode.trim());
      await refreshUser();
      setTeam(joined);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Команда не найдена');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenCode = async () => {
    if (!team) return;
    setBusy(true);
    try {
      const regenerated = await teamsApi.regenerateInviteCode(team.id);
      setTeam({ ...team, ...regenerated });
    } finally {
      setBusy(false);
    }
  };

  const isCaptain = team?.captainId === user?.id;
  const teamMemberIds = useMemo(() => new Set(team?.members.map((member) => member.userId) ?? []), [team?.members]);
  const editingTeamEvent = useMemo(
    () => events.find((item) => item.id === editingEventId) ?? null,
    [editingEventId, events],
  );

  const canEditTeamEvent = (event: CalendarEvent) => {
    if (!user || !team) return false;
    if (event.organizerId === user.id) return true;
    return Boolean(isCaptain && teamMemberIds.has(event.organizerId));
  };

  const canDeleteTeamEvent = (event: CalendarEvent) => {
    if (!user) return false;
    if (event.organizerId === user.id || user.role === 'organizer') return true;
    return Boolean(isCaptain && teamMemberIds.has(event.organizerId));
  };

  const canEditCurrentTeamEvent = !editingTeamEvent || canEditTeamEvent(editingTeamEvent);
  const canDeleteCurrentTeamEvent = Boolean(editingTeamEvent && canDeleteTeamEvent(editingTeamEvent));

  const openMemberProfile = async (userId: string) => {
    setMemberLoading(true);
    setSelectedMember(null);
    try {
      setSelectedMember(await usersApi.getUser(userId));
    } finally {
      setMemberLoading(false);
    }
  };

  const openNewTeamEvent = () => {
    const initialDate = new Date();
    initialDate.setHours(initialDate.getHours() + 1, 0, 0, 0);
    setEditingEventId(null);
    setEventForm({
      title: '',
      description: '',
      format: 'online',
      date: toDatetimeLocalValue(initialDate),
      location: '',
      onlineLink: '',
    });
    setShowTeamEventModal(true);
  };

  const openEditTeamEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      description: event.description ?? '',
      format: event.format,
      date: toDatetimeLocalValue(new Date(event.date)),
      location: event.location ?? '',
      onlineLink: event.onlineLink ?? '',
    });
    setShowTeamEventModal(true);
  };

  const closeTeamEventModal = () => {
    setShowTeamEventModal(false);
    setEditingEventId(null);
  };

  const handleSaveTeamEvent = () => {
    if (!team || !user || !eventForm.title.trim() || !eventForm.date) return;
    const existingEvent = editingEventId ? events.find((item) => item.id === editingEventId) : null;
    if (existingEvent && !canEditTeamEvent(existingEvent)) return;

    const payload: CalendarEvent = {
      id: editingEventId ?? `team-event-${Date.now()}`,
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      format: eventForm.format,
      date: new Date(eventForm.date).toISOString(),
      location: eventForm.format === 'offline' ? eventForm.location.trim() || undefined : undefined,
      onlineLink: eventForm.format === 'online' ? eventForm.onlineLink.trim() || undefined : undefined,
      organizerId: existingEvent?.organizerId ?? user.id,
      organizerName: existingEvent?.organizerName ?? [user.firstName, user.lastName].filter(Boolean).join(' '),
      invitedTeamIds: [team.id],
      createdAt: existingEvent?.createdAt ?? new Date().toISOString(),
    };

    setEvents((prev) => {
      const next = editingEventId
        ? prev.map((item) => (item.id === editingEventId ? payload : item))
        : [...prev, payload];

      return next.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    closeTeamEventModal();
  };

  const handleDeleteTeamEvent = () => {
    if (!editingTeamEvent || !canDeleteTeamEvent(editingTeamEvent) || !window.confirm('Удалить событие команды?')) return;
    setEvents((prev) => prev.filter((item) => item.id !== editingTeamEvent.id));
    closeTeamEventModal();
  };

  const inviteExpiresLabel = useMemo(() => {
    if (!team?.inviteCodeExpiresAt) return null;
    return new Date(team.inviteCodeExpiresAt).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [team?.inviteCodeExpiresAt]);

  const monthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    [calendarMonth],
  );

  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const item of events) {
      const key = getDateKey(new Date(item.date));
      const dayEvents = map.get(key) ?? [];
      dayEvents.push(item);
      map.set(key, dayEvents);
    }

    for (const [key, dayEvents] of map) {
      map.set(
        key,
        dayEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      );
    }

    return map;
  }, [events]);

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  if (!user?.teamId) {
    return (
      <div>
        <PageHeader eyebrow="Команда" title="Моя команда" />
        <div className={styles.noTeam}>
          <Card padding="lg" className={styles.noTeamCard}>
            <Empty icon="👥" message="Вы пока не в команде" hint="Создайте свою или войдите по инвайт-коду" />

            <div className={styles.noTeamActions}>
              {!showCreate ? (
                <Button onClick={() => setShowCreate(true)}>+ Создать команду</Button>
              ) : (
                <div className={styles.createForm}>
                  <Input
                    label="Название команды"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Введите название..."
                  />
                  {error && <p className={styles.err}>{error}</p>}
                  <div className={styles.rowBtns}>
                    <Button onClick={handleCreate} loading={busy}>Создать</Button>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>Отмена</Button>
                  </div>
                </div>
              )}

              <div className={styles.divider}>или</div>

              <div className={styles.createForm}>
                <Input
                  label="Код приглашения"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="BYTE2026"
                />
                {error && !showCreate && <p className={styles.err}>{error}</p>}
                <Button variant="secondary" onClick={handleJoin} loading={busy}>Войти в команду</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div>
        <PageHeader eyebrow="Команда" title="Моя команда" />
        <div className={styles.center}>
          <Empty icon="⚠️" message="Не удалось загрузить команду" hint={error || 'Попробуйте обновить страницу'} />
          <Button onClick={() => refreshUser()} style={{ marginTop: 16 }}>Обновить</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Команда"
        title={team.name}
        subtitle="Здесь собраны все ключевые показатели, события и командная активность."
      />

      <div className={styles.grid}>
        <Card padding="lg" className={styles.krkCard}>
          <span className="eyebrow">Командный рейтинг</span>
          <div className={styles.krkTotal}>{team.krk.toFixed(2)}</div>
          <Badge variant={team.league === 'Легенда' ? 'warning' : team.league === 'Профи' ? 'violet' : 'accent'}>
            Лига: {team.league}
          </Badge>

          {krk && (
            <div className={styles.krkBreakdown}>
              <KrkRow label="Базовый вклад" value={krk.baseRating} />
              <KrkRow label="Коэфф. сплочённости" value={krk.cohesionCoeff} />
              <KrkRow label="Бонусы" value={krk.bonusCoeff} />
            </div>
          )}
        </Card>

        {isCaptain && team.inviteCode && (
        <Card padding="lg">
          <span className="eyebrow">Приглашение в команду</span>
          <p className={styles.inviteHint}>Код действует 24 часа после обновления.</p>

          <div className={styles.inviteTop}>
            <div className={styles.inviteCode}>{team.inviteCode}</div>
            <Button size="sm" variant="secondary" onClick={handleRegenCode} loading={busy}>Обновить</Button>
          </div>

          {inviteExpiresLabel && <p className={styles.inviteExpires}>Действует до: {inviteExpiresLabel}</p>}
        </Card>
        )}

        <Card padding="lg" className={styles.challengesCard}>
          <div className={styles.panelHead}>
            <div>
              <span className="eyebrow">В работе</span>
              <h3 className={styles.panelTitle}>Активные челленджи</h3>
            </div>
            <Badge variant="accent">{challenges.length}</Badge>
          </div>

          {challenges.length === 0 && <Empty icon="⚡" message="Активных заданий пока нет" />}

          <div className={styles.challengeList}>
            {challenges.map((item) => (
              <div key={item.id} className={styles.challengeItem}>
                <div className={styles.challengeTop}>
                  <p className={styles.challengeTitle}>{item.title}</p>
                  <Badge variant="accent">+{item.points}</Badge>
                </div>
                <p className={styles.challengeDesc}>{item.description}</p>
                {item.deadline && <p className={styles.challengeDeadline}>До {new Date(item.deadline).toLocaleDateString('ru-RU')}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg" className={styles.membersCard}>
          <div className={styles.panelHead}>
            <div>
              <span className="eyebrow">Команда</span>
              <h3 className={styles.panelTitle}>Состав команды</h3>
            </div>
            <Badge variant="default">{team.members.length}</Badge>
          </div>

          <div className={styles.membersGrid}>
            {team.members.map((member) => (
              <button
                type="button"
                key={member.userId}
                className={styles.member}
                onClick={() => openMemberProfile(member.userId)}
              >
                <Avatar name={`${member.firstName} ${member.lastName}`} src={member.avatarUrl} size="lg" />
                <p className={styles.memberName}>{member.firstName} {member.lastName}</p>
                <p className={styles.memberRole}>{member.role === 'captain' ? '★ Капитан' : 'Участник'}</p>
                <div className={styles.memberRatingBadge}>{member.personalRating.toFixed(2)}</div>
                <span className={styles.memberRatingLabel}>КРК</span>
              </button>
            ))}
          </div>
        </Card>

        <Card padding="lg" className={styles.calendarCard}>
          <div className={styles.panelHead}>
            <div>
              <span className="eyebrow">Календарь</span>
              <h3 className={styles.panelTitle}>Календарь команды</h3>
            </div>
            <div className={styles.calendarControls}>
              <Button type="button" size="sm" onClick={openNewTeamEvent}>+ Событие команды</Button>
              <div className={styles.calendarNav}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                >
                  ←
                </Button>
                <span className={styles.calendarMonth}>{capitalize(monthLabel)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                >
                  →
                </Button>
              </div>
            </div>
          </div>

          {events.length === 0 && <Empty icon="📅" message="Командных событий пока нет" hint="Добавьте событие в календарь команды" />}

          <div className={styles.weekHeader}>
            {WEEK_DAYS.map((day) => (
              <span key={day} className={styles.weekday}>{day}</span>
            ))}
          </div>

          <div className={styles.monthGrid}>
            {monthCells.map((cell) => {
              const isCurrentDay = isToday(cell.date);
              const dayEvents = eventsByDay.get(getDateKey(cell.date)) ?? [];

              return (
                <div
                  key={cell.key}
                  className={[
                    styles.dayCell,
                    cell.inCurrentMonth ? '' : styles.dayMuted,
                    isCurrentDay ? styles.dayToday : '',
                  ].join(' ')}
                >
                  <span className={styles.dayNumber}>{cell.date.getDate()}</span>

                  <div className={styles.dayEventList}>
                    {dayEvents.slice(0, 2).map((item) => {
                      const eventDate = new Date(item.date);
                      const past = isPastEvent(item.date);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={[
                            styles.dayEvent,
                            item.format === 'online' ? styles.dayEventOnline : styles.dayEventOffline,
                            past ? styles.dayEventPast : '',
                          ].join(' ')}
                          title={`${eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · ${item.title}`}
                          onClick={() => openEditTeamEvent(item)}
                        >
                          <span className={styles.dayEventTime}>
                            {eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={styles.dayEventTitle}>{item.title}</span>
                        </button>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <span className={styles.dayMore}>+{dayEvents.length - 2} ещё</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className={styles.calendarHint}>
            Здесь отображаются только события этой команды. Нажмите на событие, чтобы посмотреть или изменить его.
          </p>
        </Card>

        <Card padding="lg" className={styles.activityCard}>
          <h3 className={styles.activityTitleHead}>История активности команды</h3>

          {activity.length === 0 && <Empty icon="📜" message="Активностей команды пока нет" />}

          <div className={styles.activityList}>
            {activity.map((item) => (
              <div key={item.id} className={styles.activityItem}>
                <span className={styles.activityIcon}>{EVENT_ICON[item.type] ?? '🔔'}</span>
                <div className={styles.activityBody}>
                  <p className={styles.activityTitle}>{item.title}</p>
                  {item.description && <p className={styles.activityDesc}>{item.description}</p>}
                  <p className={styles.activityTime}>{formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        title={memberLoading ? 'Профиль участника' : selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Профиль участника'}
        open={memberLoading || !!selectedMember}
        onClose={() => { setSelectedMember(null); setMemberLoading(false); }}
        footer={<Button variant="secondary" onClick={() => { setSelectedMember(null); setMemberLoading(false); }}>Закрыть</Button>}
      >
        {memberLoading && <div className={styles.memberModalCenter}><Spinner /></div>}
        {selectedMember && (
          <div className={styles.memberProfile}>
            <Avatar name={`${selectedMember.firstName} ${selectedMember.lastName}`} src={selectedMember.avatarUrl} size="xl" />
            <div className={styles.memberDetails}>
              <p><strong>ФИО:</strong> {[selectedMember.lastName, selectedMember.firstName, selectedMember.middleName].filter(Boolean).join(' ')}</p>
              <p><strong>Email:</strong> {selectedMember.email}</p>
              <p><strong>Телефон:</strong> {selectedMember.phone ?? 'не указан'}</p>
              {selectedMember.studentId && <p><strong>Учебный ID:</strong> {selectedMember.studentId}</p>}
              <p><strong>Рейтинг:</strong> {selectedMember.personalRating}</p>
              <p><strong>Роль:</strong> {selectedMember.role === 'captain' ? 'капитан' : selectedMember.role === 'organizer' ? 'организатор' : 'студент'}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={editingEventId ? (canEditCurrentTeamEvent ? 'Редактировать событие команды' : 'Событие команды') : 'Добавить событие команды'}
        open={showTeamEventModal}
        onClose={closeTeamEventModal}
        footer={(
          <>
            {canDeleteCurrentTeamEvent && (
              <Button variant="danger" onClick={handleDeleteTeamEvent}>Удалить</Button>
            )}
            <Button variant="secondary" onClick={closeTeamEventModal}>
              {canEditCurrentTeamEvent ? 'Отмена' : 'Закрыть'}
            </Button>
            {canEditCurrentTeamEvent && (
              <Button onClick={handleSaveTeamEvent} disabled={!eventForm.title.trim() || !eventForm.date}>Сохранить</Button>
            )}
          </>
        )}
      >
        <div className={styles.teamEventForm}>
          <Input
            label="Название"
            value={eventForm.title}
            onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
            placeholder="Командный разбор темы"
            disabled={!canEditCurrentTeamEvent}
          />
          <Textarea
            label="Описание"
            value={eventForm.description}
            onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })}
            placeholder="Что планируем сделать и кто участвует..."
            disabled={!canEditCurrentTeamEvent}
          />
          <Input
            label="Дата и время"
            type="datetime-local"
            value={eventForm.date}
            onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })}
            disabled={!canEditCurrentTeamEvent}
          />
          <div className={styles.eventFormatRow}>
            {(['online', 'offline'] as const).map((format) => (
              <button
                key={format}
                type="button"
                className={[styles.eventFormatButton, eventForm.format === format ? styles.eventFormatActive : ''].join(' ')}
                onClick={() => setEventForm({ ...eventForm, format })}
                disabled={!canEditCurrentTeamEvent}
              >
                {format === 'online' ? 'Онлайн' : 'Офлайн'}
              </button>
            ))}
          </div>
          {eventForm.format === 'online' ? (
            <Input
              label="Ссылка"
              value={eventForm.onlineLink}
              onChange={(event) => setEventForm({ ...eventForm, onlineLink: event.target.value })}
              placeholder="https://..."
              disabled={!canEditCurrentTeamEvent}
            />
          ) : (
            <Input
              label="Место"
              value={eventForm.location}
              onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })}
              placeholder="Корпус, аудитория"
              disabled={!canEditCurrentTeamEvent}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

function buildMonthCells(monthDate: Date): CalendarCell[] {
  const monthStart = startOfMonth(monthDate);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const firstCellDate = new Date(monthStart);
  firstCellDate.setDate(monthStart.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCellDate);
    date.setDate(firstCellDate.getDate() + index);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      date,
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

function getDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isToday(date: Date) {
  const now = new Date();
  return (
    now.getFullYear() === date.getFullYear()
    && now.getMonth() === date.getMonth()
    && now.getDate() === date.getDate()
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toDatetimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function KrkRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.krkRow}>
      <div className={styles.krkRowLabel}>{label}</div>
      <div className={styles.krkRowBar}>
        <div className={styles.krkRowFill} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
      <span className={styles.krkRowVal}>{value.toFixed(2)} / 100</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
