import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_ACTIVITY } from '../mock/data';
import { mapActivityFeed } from '../mappers/activity';
import type { ActivityEvent } from '@/types';

const USE_MOCK = shouldUseMock();

export const activityApi = {
  async getFeed(limit = 20): Promise<ActivityEvent[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_ACTIVITY.slice(0, limit); }
    const data = await http.get<{ activities: Parameters<typeof mapActivityFeed>[0]['activities']; total: number }>(
      `/feed?limit=${limit}`,
    );
    return mapActivityFeed(data);
  },
};
