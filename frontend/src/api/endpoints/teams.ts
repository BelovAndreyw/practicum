import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_TEAMS } from '../mock/data';
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
    return http.get<Team>(`/teams/${id}`);
  },

  async listTeams(): Promise<Team[]> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_TEAMS;
    }
    return http.get<Team[]>('/teams');
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
    return http.post<Team>('/teams', { name });
  },

  async joinByCode(code: string): Promise<Team> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.inviteCode === code.toUpperCase());
      if (!t) throw new Error('Команда с таким кодом не найдена');
      return t;
    }
    return http.post<Team>('/teams/join', { inviteCode: code });
  },

  async getKrkBreakdown(teamId: string): Promise<KrkBreakdown> {
    if (USE_MOCK) {
      await mockDelay();
      const t = MOCK_TEAMS.find((team) => team.id === teamId);
      if (!t) throw new Error('Team not found');
      const base = t.krk * 0.6;
      const cohesion = t.krk * 0.3;
      const bonus = t.krk * 0.1;
      return {
        baseRating: +base.toFixed(1),
        cohesionCoeff: +cohesion.toFixed(1),
        bonusCoeff: +bonus.toFixed(1),
        total: t.krk,
      };
    }
    return http.get<KrkBreakdown>(`/teams/${teamId}/krk`);
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
    return http.post<{ inviteCode: string; inviteCodeUpdatedAt: string; inviteCodeExpiresAt: string }>(`/teams/${teamId}/invite-code`);
  },
};
