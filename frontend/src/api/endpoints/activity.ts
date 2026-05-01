import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_ACTIVITY } from '../mock/data';
import type { ActivityEvent } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const activityApi = {
  async getFeed(limit = 20): Promise<ActivityEvent[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_ACTIVITY.slice(0, limit); }
    return http.get<ActivityEvent[]>(`/activity?limit=${limit}`);
  },
};
