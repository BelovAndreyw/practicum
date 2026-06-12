import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_CHECKINS } from '../mock/data';
import { mapCheckin, mapCheckinList, toBackendCheckinCreate } from '../mappers/checkin';
import type { CheckIn } from '@/types';

const USE_MOCK = shouldUseMock();

export const checkinApi = {
  async list(teamId: string): Promise<CheckIn[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHECKINS.filter((c) => c.teamId === teamId); }
    const data = await http.get<Parameters<typeof mapCheckinList>[0]>(`/checkins/team/${teamId}`);
    return mapCheckinList(data);
  },

  async submit(data: Omit<CheckIn, 'id' | 'submittedAt' | 'submittedByUserId'>): Promise<CheckIn> {
    if (USE_MOCK) {
      await mockDelay(600);
      const ci: CheckIn = { ...data, id: `ci${Date.now()}`, submittedAt: new Date().toISOString(), submittedByUserId: 'u1' };
      MOCK_CHECKINS.push(ci);
      return ci;
    }
    const created = await http.post<Parameters<typeof mapCheckin>[0]>('/checkins', toBackendCheckinCreate(data));
    return mapCheckin(created);
  },

  async listAll(): Promise<CheckIn[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_CHECKINS; }
    const data = await http.get<Parameters<typeof mapCheckinList>[0]>('/checkins/pending');
    return mapCheckinList(data);
  },
};
