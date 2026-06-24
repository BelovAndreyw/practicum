import type { CheckIn } from '@/types';

interface BackendCheckin {
  id: number;
  team_id: number;
  week_start_date: string;
  content?: string | null;
  achievements?: string | null;
  blockers?: string | null;
  created_by: number;
  created_at: string;
  status: string;
}

interface BackendCheckinList {
  checkins: BackendCheckin[];
  total: number;
}

export function mapCheckin(item: BackendCheckin): CheckIn {
  return {
    id: String(item.id),
    teamId: String(item.team_id),
    weekLabel: new Date(item.week_start_date).toLocaleDateString('ru-RU'),
    summary: item.content ?? '',
    achievements: item.achievements ?? '',
    blockers: item.blockers ?? undefined,
    submittedAt: item.created_at,
    submittedByUserId: String(item.created_by),
  };
}

export function mapCheckinList(data: BackendCheckinList): CheckIn[] {
  return data.checkins.map(mapCheckin);
}

export function toBackendCheckinCreate(data: {
  weekLabel: string;
  summary: string;
  achievements: string;
}) {
  const parsedWeek = data.weekLabel ? new Date(data.weekLabel) : new Date();
  const weekStart = Number.isNaN(parsedWeek.getTime())
    ? new Date().toISOString()
    : parsedWeek.toISOString();

  return {
    week_start_date: weekStart,
    content: data.summary,
    achievements: data.achievements || null,
    blockers: null,
  };
}
