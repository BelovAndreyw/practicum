import { http } from '../client';
import { ratingApi } from './rating';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_TEAMS } from '../mock/data';
import {
  mapKrkFromRating,
  mapTeamDetail,
  mapTeamSummary,
  type BackendInviteLink,
  type BackendTeamDetail,
  type BackendTeamProfile,
  type BackendTeamSummary,
} from '../mappers/team';
import type { Team, KrkBreakdown } from '@/types';

const USE_MOCK = shouldUseMock();

export const teamsApi = {
  async getTeam(id: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === id);
      if (!t) throw new Error('Team not found');
      return t;
    }
    const data = await http.get<BackendTeamDetail>(`/team/${id}`);
    const team = mapTeamDetail(data);

    // КРК и лига приходят из общего рейтинга команд (average_krk, шкала 0–100)
    try {
      const ratings = await ratingApi.getTeamRating();
      const entry = ratings.find((r) => r.team.id === id);
      if (entry) {
        team.krk = entry.team.krk;
        team.league = entry.team.league;
      }
    } catch {
      // рейтинг недоступен — оставляем значения по умолчанию
    }

    // Активный инвайт-код (доступен капитану); для остальных эндпоинт вернёт 403
    try {
      const invites = await http.get<{ links: BackendInviteLink[] }>(`/team/${id}/invites`);
      const active = invites.links.find((l) => l.is_active) ?? invites.links[0];
      if (active) team.inviteCode = active.token;
    } catch {
      // нет прав или ссылок — код останется пустым
    }

    return team;
  },

  async listTeams(): Promise<Team[]> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_TEAMS;
    }
    const data = await http.get<BackendTeamSummary[]>(`/team/search?query=${encodeURIComponent('*')}`);
    return data.map((t) => mapTeamSummary(t));
  },

  async createTeam(name: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const now = new Date();
      const newTeam: Team = {
        id: `t${Date.now()}`,
        name,
        captainId: 'u1',
        members: [{ userId: 'u1', firstName: 'Aleksei', lastName: 'Petrov', role: 'captain', personalRating: 87 }],
        krk: 0,
        league: 'Новичок',
        inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
        inviteCodeUpdatedAt: now.toISOString(),
        inviteCodeExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        activityHistory: [],
        createdAt: now.toISOString(),
      };
      MOCK_TEAMS.push(newTeam);
      return newTeam;
    }
    const data = await http.post<BackendTeamSummary>('/team/create', { name });
    return mapTeamSummary(data);
  },

  async joinByCode(code: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.inviteCode === code.toUpperCase());
      if (!t) throw new Error('Команда с таким кодом не найдена');
      return t;
    }
    await http.post('/team/join-by-link', { token: code });
    const profile = await http.get<{ team_id?: number | null }>('/team/profile');
    if (!profile.team_id) throw new Error('Не удалось вступить в команду');
    return teamsApi.getTeam(String(profile.team_id));
  },

  async getKrkBreakdown(teamId: string): Promise<KrkBreakdown> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === teamId);
      if (!t) throw new Error('Team not found');
      return mapKrkFromRating(t.krk);
    }

    // Предпочитаем КРК (0–100) из общего рейтинга команд
    try {
      const ratings = await ratingApi.getTeamRating();
      const entry = ratings.find((r) => r.team.id === teamId);
      if (entry) return mapKrkFromRating(entry.team.krk);
    } catch {
      // упадём на профиль ниже
    }

    const data = await http.get<BackendTeamProfile>(`/teams/${teamId}/profile`);
    return mapKrkFromRating(data.rating);
  },

  async regenerateInviteCode(teamId: string): Promise<{ inviteCode: string; inviteCodeUpdatedAt: string; inviteCodeExpiresAt: string }> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === teamId);
      if (!t) throw new Error('Team not found');

      const updatedAt = new Date();
      const expiresAt = new Date(updatedAt.getTime() + 24 * 60 * 60 * 1000);
      t.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      t.inviteCodeUpdatedAt = updatedAt.toISOString();
      t.inviteCodeExpiresAt = expiresAt.toISOString();

      return {
        inviteCode: t.inviteCode,
        inviteCodeUpdatedAt: t.inviteCodeUpdatedAt,
        inviteCodeExpiresAt: t.inviteCodeExpiresAt,
      };
    }
    const data = await http.post<BackendInviteLink>(`/team/${teamId}/invite`, {});
    const updatedAt = new Date().toISOString();
    return {
      inviteCode: data.token,
      inviteCodeUpdatedAt: updatedAt,
      inviteCodeExpiresAt: data.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};
