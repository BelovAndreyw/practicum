import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_TEAM_RATING, MOCK_USER_RATING } from '../mock/data';
import { mapTeamRatingList, mapUserRatingList } from '../mappers/rating';
import type { TeamRatingEntry, UserRatingEntry } from '@/types';

const USE_MOCK = shouldUseMock();

export const ratingApi = {
  async getTeamRating(): Promise<TeamRatingEntry[]> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_TEAM_RATING;
    }

    const data = await http.get<Parameters<typeof mapTeamRatingList>[0]>('/rating/top-teams?limit=50');
    return mapTeamRatingList(data);
  },

  async getUserRating(filters?: { teamId?: string; stream?: string; q?: string }): Promise<UserRatingEntry[]> {
    if (USE_MOCK) {
      await mockDelay();

      let list = MOCK_USER_RATING;
      if (filters?.teamId) list = list.filter((entry) => entry.teamId === filters.teamId);
      if (filters?.stream) list = list.filter((entry) => entry.stream === filters.stream);

      return list;
    }

    const params = new URLSearchParams({ limit: '100' });
    if (filters?.teamId) params.set('team_id', filters.teamId);
    if (filters?.q) params.set('q', filters.q);
    const data = await http.get<Parameters<typeof mapUserRatingList>[0]>(`/rating/leaderboard?${params}`);
    let list = mapUserRatingList(data);
    if (filters?.stream) list = list.filter((entry) => entry.stream === filters.stream);
    return list;
  },
};
