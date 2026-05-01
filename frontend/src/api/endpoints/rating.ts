import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_TEAM_RATING, MOCK_USER_RATING } from '../mock/data';
import type { TeamRatingEntry, UserRatingEntry } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const ratingApi = {
  async getTeamRating(): Promise<TeamRatingEntry[]> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_TEAM_RATING;
    }

    return http.get<TeamRatingEntry[]>('/rating/teams');
  },

  async getUserRating(filters?: { teamId?: string; stream?: string }): Promise<UserRatingEntry[]> {
    if (USE_MOCK) {
      await mockDelay();

      let list = MOCK_USER_RATING;
      if (filters?.teamId) list = list.filter((entry) => entry.teamId === filters.teamId);
      if (filters?.stream) list = list.filter((entry) => entry.stream === filters.stream);

      return list;
    }

    const params = new URLSearchParams(filters as Record<string, string>).toString();
    return http.get<UserRatingEntry[]>(`/rating/users${params ? `?${params}` : ''}`);
  },
};
