import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_RESCUES } from '../mock/data';
import type { RescueRequest, RescueStatus } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const rescueApi = {
  async list(): Promise<RescueRequest[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_RESCUES; }
    return http.get<RescueRequest[]>('/rescues');
  },

  async create(data: Pick<RescueRequest, 'topic' | 'description'>): Promise<RescueRequest> {
    if (USE_MOCK) {
      await mockDelay(600);
      const r: RescueRequest = { ...data, id: `rs${Date.now()}`, requesterTeamId: 't1', requesterTeamName: 'Байты Знаний', status: 'pending', bonusPoints: 40, createdAt: new Date().toISOString() };
      MOCK_RESCUES.push(r);
      return r;
    }
    return http.post<RescueRequest>('/rescues', data);
  },

  async updateStatus(id: string, status: RescueStatus): Promise<RescueRequest> {
    if (USE_MOCK) {
      await mockDelay();
      const r = MOCK_RESCUES.find((r) => r.id === id)!;
      r.status = status;
      if (status === 'confirmed') r.confirmedAt = new Date().toISOString();
      return r;
    }
    return http.patch<RescueRequest>(`/rescues/${id}`, { status });
  },
};
