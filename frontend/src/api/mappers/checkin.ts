import type { CheckIn } from '@/types';

interface BackendCheckin {
  id: number;
  team_id: number;
  week_start_date: string;
  content?: string | null;
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
    achievements: '',
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
  blockers?: string;
}) {
  const parts = [
    data.summary && `Итоги: ${data.summary}`,
    data.achievements && `Достижения: ${data.achievements}`,
    data.blockers && `Блокеры: ${data.blockers}`,
  ].filter(Boolean);

  const weekStart = data.weekLabel
    ? new Date(data.weekLabel).toISOString()
    : new Date().toISOString();

  return {
    week_start_date: weekStart,
    content: parts.join('\n\n') || data.summary,
  };
}
