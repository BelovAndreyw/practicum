import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_CHECKINS } from '../mock/data';
import type { CheckIn } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const checkinApi = {
  async list(teamId: string): Promise<CheckIn[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHECKINS.filter((c) => c.teamId === teamId); }
    return http.get<CheckIn[]>(`/checkins?teamId=${teamId}`);
  },

  async submit(data: Omit<CheckIn, 'id' | 'submittedAt' | 'submittedByUserId'>): Promise<CheckIn> {
    if (USE_MOCK) {
      await mockDelay(600);
      const ci: CheckIn = { ...data, id: `ci${Date.now()}`, submittedAt: new Date().toISOString(), submittedByUserId: 'u1' };
      MOCK_CHECKINS.push(ci);
      return ci;
    }
    return http.post<CheckIn>('/checkins', data);
  },

  // Организатор
  async listAll(): Promise<CheckIn[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHECKINS; }
    return http.get<CheckIn[]>('/checkins');
  },
};
