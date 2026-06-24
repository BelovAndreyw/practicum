import { http } from '../client';
import { authApi } from './auth';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_USERS } from '../mock/data';
import {
  mapBackendUser,
  mapLeague,
  mapKrkBreakdown,
  type BackendAchievement,
} from '../mappers/user';
import type { User } from '@/types';

const USE_MOCK = shouldUseMock();

interface BackendPublicUserProfile {
  id: number;
  full_name: string;
  role: string;
  team_name?: string | null;
  team_id?: number | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  personal_rating: number;
  league?: string | null;
  krk_breakdown?: {
    base_score: number;
    unity_score: number;
    bonus_score: number;
    total_krk: number;
  } | null;
  achievements?: BackendAchievement[];
}

export const usersApi = {
  async getUser(id: string): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const u = MOCK_USERS.find((item) => item.id === id);
      if (!u) throw new Error('User not found');
      return u;
    }

    const data = await http.get<BackendPublicUserProfile>(`/team/users/${id}`);
    const krkBreakdown = data.krk_breakdown
      ? mapKrkBreakdown({
          total_krk: data.krk_breakdown.total_krk,
          base_score: data.krk_breakdown.base_score,
          unity_score: data.krk_breakdown.unity_score,
          bonus_score: data.krk_breakdown.bonus_score,
          penalty_score: 0,
          league: data.league ?? '',
        })
      : undefined;

    return mapBackendUser(
      {
        id: data.id,
        username: '',
        student_id: 0,
        full_name: data.full_name,
        role: data.role,
        email: data.email,
        phone: data.phone,
        avatar_url: data.avatar_url,
        achievements: data.achievements,
      },
      {
        teamId: data.team_id != null ? String(data.team_id) : undefined,
        teamName: data.team_name ?? undefined,
        personalRating: data.personal_rating,
        league: data.league ? mapLeague(data.league) : '',
        krkBreakdown,
      },
    );
  },

  async updateUser(id: string, data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'email' | 'phone'>> & { avatarUrl?: string | null }): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const idx = MOCK_USERS.findIndex((item) => item.id === id);
      if (idx < 0) throw new Error('User not found');
      MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data };
      return MOCK_USERS[idx];
    }

    const body: Record<string, string | null> = {};
    if (data.lastName !== undefined) body.surname = data.lastName;
    if (data.firstName !== undefined) body.name = data.firstName;
    if (data.patronymic !== undefined) body.patronymic = data.patronymic ?? '';
    if (data.email !== undefined) body.email = data.email;
    if (data.phone !== undefined) body.phone = data.phone ?? '';
    if (data.avatarUrl !== undefined) body.avatar_url = data.avatarUrl || null;

    await http.patch('/team/profile', body);

    return authApi.me();
  },

  async uploadAvatar(file: File): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const url = URL.createObjectURL(file);
      const user = MOCK_USERS[0];
      if (user) user.avatarUrl = url;
      return user ?? (await authApi.me());
    }

    const form = new FormData();
    form.append('file', file);
    await http.postForm<BackendUserProfileResponse>('/team/profile/avatar', form);
    return authApi.me();
  },

  async removeAvatar(): Promise<User> {
    if (USE_MOCK) {
      await mockDelay();
      const user = MOCK_USERS[0];
      if (user) user.avatarUrl = undefined;
      return user ?? (await authApi.me());
    }

    await http.delete('/team/profile/avatar');
    return authApi.me();
  },
};
