import { http, setAuthToken } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_ME, MOCK_USERS } from '../mock/data';
import {
  mapBackendUser,
  mapLeague,
  mapKrkBreakdown,
  type BackendUserProfileResponse,
  type BackendUserResponse,
  type BackendMyRating,
} from '../mappers/user';
import type { User } from '@/types';

const USE_MOCK = shouldUseMock();

export interface LoginPayload { username: string; password: string; }
export interface AuthResponse  { user: User; token: string; }

interface BackendLoginResponse {
  access_token: string;
  token_type?: string;
}

async function enrichUserFromProfile(base: User): Promise<User> {
  try {
    const [profile, rating] = await Promise.all([
      http.get<BackendUserProfileResponse>('/team/profile'),
      http.get<BackendMyRating>('/rating/my-rating').catch(() => null),
    ]);

    const krkBreakdown = rating ? mapKrkBreakdown(rating) : base.krkBreakdown;

    const enriched = mapBackendUser(profile, {
      teamId: profile.team_id != null ? String(profile.team_id) : undefined,
      personalRating: Math.round((rating?.total_krk ?? base.personalRating) * 100) / 100,
      league: rating?.league ? mapLeague(rating.league) : base.league,
      krkBreakdown,
    });
    // Достижения всегда из /auth/me (там sync по фактическим действиям)
    return { ...enriched, achievements: base.achievements };
  } catch {
    return base;
  }
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await mockDelay();
      const found = MOCK_USERS.find((u) => u.email === payload.username) ?? MOCK_ME;
      return { user: found, token: 'mock-jwt-token' };
    }

    const data = await http.post<BackendLoginResponse>('/auth/login', payload);
    setAuthToken(data.access_token);
    const user = await authApi.me();
    return { user, token: data.access_token };
  },

  async logout(): Promise<void> {
    if (USE_MOCK) { await mockDelay(100); return; }
    setAuthToken(null);
  },

  async me(): Promise<User> {
    if (USE_MOCK) { await mockDelay(200); return MOCK_ME; }
    const data = await http.get<BackendUserResponse>('/auth/me');
    const base = mapBackendUser(data);
    return enrichUserFromProfile(base);
  },
};
