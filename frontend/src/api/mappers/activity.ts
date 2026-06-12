import type { ActivityEvent, ActivityEventType } from '@/types';

interface BackendActivity {
  id: number;
  team_id: number;
  user_id?: number | null;
  event_type: string;
  title: string;
  description?: string | null;
  created_at: string;
}

interface BackendActivityFeed {
  activities: BackendActivity[];
  total: number;
}

const EVENT_TYPE_MAP: Record<string, ActivityEventType> = {
  achievement_unlocked: 'achievement_unlocked',
  challenge_completed: 'challenge_completed',
  rating_updated: 'rating_updated',
  team_joined: 'team_joined',
  rescue_completed: 'rescue_completed',
  event_created: 'event_created',
  checkin_submitted: 'checkin_submitted',
};

export function mapActivityEvent(item: BackendActivity): ActivityEvent {
  return {
    id: String(item.id),
    type: EVENT_TYPE_MAP[item.event_type] ?? 'rating_updated',
    title: item.title,
    description: item.description ?? undefined,
    actorId: item.user_id != null ? String(item.user_id) : undefined,
    teamId: String(item.team_id),
    createdAt: item.created_at,
  };
}

export function mapActivityFeed(data: BackendActivityFeed): ActivityEvent[] {
  return data.activities.map(mapActivityEvent);
}
