import { http } from '../client';
import { authApi } from './auth';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_USERS } from '../mock/data';
import { ApiError } from '../client';
import type { User } from '@/types';

const USE_MOCK = shouldUseMock();

export const usersApi = {
  async getUser(id: string): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const u = MOCK_USERS.find((item) => item.id === id);
      if (!u) throw new Error('User not found');
      return u;
    }
    throw new ApiError(501, 'Просмотр профиля другого пользователя пока недоступен');
  },

  async updateUser(id: string, data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'avatarUrl'>>): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const idx = MOCK_USERS.findIndex((item) => item.id === id);
      if (idx < 0) throw new Error('User not found');
      MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data };
      return MOCK_USERS[idx];
    }

    await http.patch('/team/profile', {
      surname: data.lastName,
      name: data.firstName,
      patronymic: data.middleName,
    });

    return authApi.me();
  },
};
