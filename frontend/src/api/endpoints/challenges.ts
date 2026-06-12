import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_CHALLENGES } from '../mock/data';
import { mapChallengeList, toBackendChallengeCreate } from '../mappers/challenges';
import type { Challenge, ChallengeReport } from '@/types';

const USE_MOCK = shouldUseMock();

export const challengesApi = {
  async list(): Promise<Challenge[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHALLENGES; }
    const data = await http.get<Parameters<typeof mapChallengeList>[0]>('/challenges');
    return mapChallengeList(data);
  },

  async submitReport(report: Omit<ChallengeReport, 'submittedAt'>): Promise<void> {
    if (USE_MOCK) { await mockDelay(600); return; }
    const form = new FormData();
    form.append('title', `Отчёт по челленджу #${report.challengeId}`);
    form.append('description', report.comment);
    if (report.challengeId) form.append('challenge_id', report.challengeId);
    await http.postForm('/reports', form);
  },

  async create(data: Pick<Challenge, 'title' | 'description' | 'points' | 'deadline' | 'acceptsReport'>): Promise<Challenge> {
    if (USE_MOCK) {
      await mockDelay();
      const c: Challenge = { ...data, id: `ch${Date.now()}`, status: 'active', completedByTeamIds: [], createdAt: new Date().toISOString() };
      MOCK_CHALLENGES.push(c);
      return c;
    }
    const created = await http.post<Parameters<typeof mapChallengeList>[0]['challenges'][0]>(
      '/challenges',
      toBackendChallengeCreate(data),
    );
    return mapChallengeList({ challenges: [created], total: 1 })[0];
  },
};
