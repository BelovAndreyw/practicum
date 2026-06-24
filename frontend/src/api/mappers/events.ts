import type { CalendarEvent, EventFormat } from '@/types';
import { resolveMediaUrl } from './user';

interface BackendEvent {
  id: number;
  team_id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  format: string;
  location?: string | null;
  starts_at: string;
  created_by: number;
  organizer_name?: string | null;
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
    imageUrl: resolveMediaUrl(event.image_url),
    format: fmt,
    date: event.starts_at,
    location: fmt === 'offline' ? (event.location ?? undefined) : undefined,
    onlineLink: fmt === 'online' ? (event.location ?? undefined) : undefined,
    organizerId: String(event.created_by),
    organizerName: event.organizer_name ?? `Команда #${event.team_id}`,
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
  imageUrl?: string | null;
  format: EventFormat;
  date: string;
  location?: string;
  onlineLink?: string;
  teamId?: string;
}) {
  return {
    title: data.title,
    description: data.description,
    image_url: data.imageUrl,
    format: data.format,
    location: data.format === 'offline' ? data.location : data.onlineLink,
    starts_at: data.date,
    event_type: 'workshop',
    is_public: true,
    team_id: data.teamId ? Number(data.teamId) : undefined,
  };
}

export function toBackendEventUpdate(data: {
  title?: string;
  description?: string;
  imageUrl?: string | null;
  format?: EventFormat;
  date?: string;
  location?: string;
  onlineLink?: string;
}) {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.imageUrl !== undefined) payload.image_url = data.imageUrl;
  if (data.format !== undefined) payload.format = data.format;
  if (data.date !== undefined) payload.starts_at = data.date;
  if (data.location !== undefined || data.onlineLink !== undefined) {
    payload.location = data.format === 'offline' ? data.location : data.onlineLink;
  }
  return payload;
}
