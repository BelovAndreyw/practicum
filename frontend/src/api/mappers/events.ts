import type { CalendarEvent, EventFormat } from '@/types';

interface BackendEvent {
  id: number;
  team_id: number;
  title: string;
  description?: string | null;
  format: string;
  location?: string | null;
  starts_at: string;
  created_by: number;
  created_at: string;
}

interface BackendEventList {
  events: BackendEvent[];
  total: number;
}

function mapFormat(format: string): EventFormat {
  return format === 'offline' ? 'offline' : 'online';
}

export function mapEvent(event: BackendEvent): CalendarEvent {
  const fmt = mapFormat(event.format);
  return {
    id: String(event.id),
    title: event.title,
    description: event.description ?? undefined,
    format: fmt,
    date: event.starts_at,
    location: fmt === 'offline' ? (event.location ?? undefined) : undefined,
    onlineLink: fmt === 'online' ? (event.location ?? undefined) : undefined,
    organizerId: String(event.created_by),
    organizerName: `User #${event.created_by}`,
    invitedTeamIds: [String(event.team_id)],
    createdAt: event.created_at,
  };
}

export function mapEventList(data: BackendEventList): CalendarEvent[] {
  return data.events.map(mapEvent);
}

export function toBackendEventCreate(data: {
  title: string;
  description?: string;
  format: EventFormat;
  date: string;
  location?: string;
  onlineLink?: string;
}) {
  return {
    title: data.title,
    description: data.description,
    format: data.format,
    location: data.format === 'offline' ? data.location : data.onlineLink,
    starts_at: data.date,
    event_type: 'workshop',
    is_public: true,
  };
}
