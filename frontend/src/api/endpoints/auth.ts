import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_ME, MOCK_USERS } from '../mock/data';
import type { User } from '@/types';

const USE_MOCK = shouldUseMock();

export interface LoginPayload { email: string; password: string; }
export interface AuthResponse  { user: User; token: string; }

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await mockDelay();
      const found = MOCK_USERS.find((u) => u.email === payload.email) ?? MOCK_ME;
      return { user: found, token: 'mock-jwt-token' };
    }
    return http.post<AuthResponse>('/auth/login', payload);
  },

  async logout(): Promise<void> {
    if (USE_MOCK) { await mockDelay(100); return; }
    return http.post('/auth/logout');
  },

  async me(): Promise<User> {
    if (USE_MOCK) { await mockDelay(200); return MOCK_ME; }
    return http.get<User>('/auth/me');
  },
};
