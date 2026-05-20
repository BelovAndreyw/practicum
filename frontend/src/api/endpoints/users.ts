import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_USERS } from '../mock/data';
import type { User } from '@/types';

const USE_MOCK = shouldUseMock();

export const usersApi = {
  async getUser(id: string): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const u = MOCK_USERS.find((u) => u.id === id);
      if (!u) throw new Error('User not found');
      return u;
    }
    return http.get<User>(`/users/${id}`);
  },

  async updateUser(id: string, data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'avatarUrl'>>): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const idx = MOCK_USERS.findIndex((u) => u.id === id);
      if (idx < 0) throw new Error('User not found');
      MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data };
      return MOCK_USERS[idx];
    }
    return http.patch<User>(`/users/${id}`, data);
  },
};
