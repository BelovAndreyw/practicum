import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_CHALLENGES } from '../mock/data';
import type { Challenge, ChallengeReport } from '@/types';

const USE_MOCK = shouldUseMock();

export const challengesApi = {
  async list(): Promise<Challenge[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHALLENGES; }
    return http.get<Challenge[]>('/challenges');
  },

  async submitReport(report: Omit<ChallengeReport, 'submittedAt'>): Promise<void> {
    if (USE_MOCK) { await mockDelay(600); return; }
    return http.post('/challenges/reports', report);
  },

  // Организатор
  async create(data: Pick<Challenge, 'title' | 'description' | 'points' | 'deadline' | 'acceptsReport'>): Promise<Challenge> {
    if (USE_MOCK) {
      await mockDelay();
      const c: Challenge = { ...data, id: `ch${Date.now()}`, status: 'active', completedByTeamIds: [], createdAt: new Date().toISOString() };
      MOCK_CHALLENGES.push(c);
      return c;
    }
    return http.post<Challenge>('/challenges', data);
  },
};
