import { http } from '../client';
import { ratingApi } from './rating';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { getMockInviteOverride, setMockInviteOverride } from '../mock/inviteCodes';
import { MOCK_TEAMS } from '../mock/data';
import {
  mapKrkFromRating,
  mapKrkFromComponents,
  mapTeamDetail,
  mapTeamSummary,
  type BackendInviteLink,
  type BackendTeamDetail,
  type BackendTeamSummary,
} from '../mappers/team';
import type { Team, KrkBreakdown } from '@/types';

const USE_MOCK = shouldUseMock();

function applyMockInvite(team: Team): Team {
  const override = getMockInviteOverride(team.id);
  return override ? { ...team, ...override } : team;
}

export const teamsApi = {
  async getTeam(id: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === id);
      if (!t) throw new Error('Team not found');
      return applyMockInvite(t);
    }
    const data = await http.get<BackendTeamDetail>(`/team/${id}`);
    const team = mapTeamDetail(data, data.average_krk ?? 0);

    // Лига и актуальный КРК из общего рейтинга (если доступен)
    try {
      const ratings = await ratingApi.getTeamRating();
      const entry = ratings.find((r) => r.team.id === id);
      if (entry) {
        team.krk = entry.team.krk;
        team.league = entry.team.league;
      }
    } catch {
      // рейтинг недоступен — используем average_krk из деталей команды
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
    const team = mapTeamSummary(data);
    try {
      const invites = await http.get<{ links: BackendInviteLink[] }>(`/team/${data.id}/invites`);
      const active = invites.links.find((l) => l.is_active !== false) ?? invites.links[0];
      if (active) {
        team.inviteCode = active.token;
        if (active.expires_at) team.inviteCodeExpiresAt = active.expires_at;
      }
    } catch {
      // код подтянется при следующей загрузке страницы
    }
    return team;
  },

  async joinByCode(code: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.inviteCode === code.toUpperCase());
      if (!t) throw new Error('Команда с таким кодом не найдена');
      return t;
    }
    await http.post('/team/join-by-link', { token: code.trim().toUpperCase() });
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

    try {
      const data = await http.get<{
        base_score: number;
        unity_score: number;
        bonus_score: number;
        total_krk: number;
      }>(`/rating/team/${teamId}/breakdown`);
      return mapKrkFromComponents(
        data.base_score,
        data.unity_score,
        data.bonus_score,
        data.total_krk,
      );
    } catch {
      const ratings = await ratingApi.getTeamRating();
      const entry = ratings.find((r) => r.team.id === teamId);
      if (entry) return mapKrkFromRating(entry.team.krk);
      throw new Error('Не удалось загрузить разбивку КРК');
    }
  },

  async regenerateInviteCode(teamId: string): Promise<{ inviteCode: string; inviteCodeUpdatedAt: string; inviteCodeExpiresAt: string }> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === teamId);
      if (!t) throw new Error('Team not found');

      const updatedAt = new Date();
      const expiresAt = new Date(updatedAt.getTime() + 24 * 60 * 60 * 1000);
      const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const payload = {
        inviteCode,
        inviteCodeUpdatedAt: updatedAt.toISOString(),
        inviteCodeExpiresAt: expiresAt.toISOString(),
      };
      t.inviteCode = payload.inviteCode;
      t.inviteCodeUpdatedAt = payload.inviteCodeUpdatedAt;
      t.inviteCodeExpiresAt = payload.inviteCodeExpiresAt;
      setMockInviteOverride(teamId, payload);

      return payload;
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
