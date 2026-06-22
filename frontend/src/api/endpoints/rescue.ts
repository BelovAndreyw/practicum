import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_RESCUES } from '../mock/data';
import {
  mapRescueList,
  mapRescueRequest,
  type BackendHelpDetail,
  type BackendHelpList,
} from '../mappers/help';
import type { RescueRequest, RescueStatus } from '@/types';

const USE_MOCK = shouldUseMock();

export const rescueApi = {
  async list(): Promise<RescueRequest[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_RESCUES; }
    const data = await http.get<BackendHelpList>('/help?help_type=receiving');
    return mapRescueList(data);
  },

  async create(data: Pick<RescueRequest, 'topic' | 'description'>): Promise<RescueRequest> {
    if (USE_MOCK) {
      await mockDelay(600);
      const r: RescueRequest = { ...data, id: `rs${Date.now()}`, requesterTeamId: 't1', requesterTeamName: 'Байты Знаний', status: 'pending', bonusPoints: 40, createdAt: new Date().toISOString() };
      MOCK_RESCUES.push(r);
      return r;
    }
    const created = await http.post<BackendHelpList['requests'][0]>('/help', {
      title: data.topic,
      description: data.description,
      help_type: 'receiving',
      format: 'both',
    });
    return mapRescueRequest(created);
  },

  async updateStatus(id: string, status: RescueStatus): Promise<RescueRequest> {
    if (USE_MOCK) {
      await mockDelay();
      const r = MOCK_RESCUES.find((item) => item.id === id)!;
      r.status = status;
      if (status === 'confirmed') r.confirmedAt = new Date().toISOString();
      return r;
    }

    if (status === 'accepted') {
      await http.post(`/help/${id}/respond`, { message: 'Готовы помочь' });
    } else if (status === 'confirmed') {
      const detail = await http.get<BackendHelpDetail>(`/help/${id}`);
      const response = detail.responses.find(
        (r) => r.status === 'pending' || r.status === 'accepted',
      );
      if (!response) throw new Error('Нет отклика для подтверждения');
      await http.post(`/help/${id}/accept/${response.id}`);
    } else if (status === 'rejected') {
      await http.post(`/help/${id}/cancel`);
    }

    const detail = await http.get<BackendHelpDetail>(`/help/${id}`);
    return mapRescueRequest(detail);
  },
};
