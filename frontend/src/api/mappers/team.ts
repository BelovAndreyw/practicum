import type { Team, TeamMember, KrkBreakdown, UserRole } from '@/types';
import { mapLeague, splitFullName } from './user';

export interface BackendTeamSummary {
  id: number;
  name: string;
  description?: string | null;
  captain_id: number;
  captain_name?: string | null;
  members_count: number;
  rating?: number;
  created_at: string;
}

export interface BackendTeamMember {
  user_id: number;
  username: string;
  full_name: string;
  joined_at: string;
}

export interface BackendTeamDetail extends BackendTeamSummary {
  members: BackendTeamMember[];
}

export interface BackendTeamProfile {
  id: number;
  name: string;
  captain_id: number;
  captain_name?: string | null;
  members_count: number;
  rating: number;
  created_at: string;
}

export interface BackendInviteLink {
  token: string;
  team_name: string;
  expires_at?: string | null;
}

function mapMember(member: BackendTeamMember, captainId: number): TeamMember {
  const { firstName, lastName } = splitFullName(member.full_name);
  const role: UserRole = member.user_id === captainId ? 'captain' : 'student';
  return {
    userId: String(member.user_id),
    firstName,
    lastName,
    role,
    personalRating: 0,
  };
}

export function mapTeamSummary(data: BackendTeamSummary, krk?: number, league = ''): Team {
  const teamKrk = krk ?? data.rating ?? 0;
  return {
    id: String(data.id),
    name: data.name,
    captainId: String(data.captain_id),
    members: Array.from({ length: data.members_count }, (_, index) => ({
      userId: `${data.id}-m${index}`,
      firstName: '',
      lastName: '',
      role: 'student' as const,
      personalRating: 0,
    })),
    krk: teamKrk,
    league: league || 'Новичок',
    inviteCode: '',
    activityHistory: [],
    createdAt: data.created_at,
  };
}

export function mapTeamDetail(data: BackendTeamDetail, krk = 0, league = ''): Team {
  return {
    ...mapTeamSummary(data, krk, league),
    members: data.members.map((m) => mapMember(m, data.captain_id)),
  };
}

export function mapKrkFromRating(rating: number): KrkBreakdown {
  const base = rating * 0.6;
  const cohesion = rating * 0.3;
  const bonus = rating * 0.1;
  return {
    baseRating: +base.toFixed(1),
    cohesionCoeff: +cohesion.toFixed(1),
    bonusCoeff: +bonus.toFixed(1),
    total: rating,
  };
}

export function mapTeamProfile(data: BackendTeamProfile): Team {
  return {
    id: String(data.id),
    name: data.name,
    captainId: String(data.captain_id),
    members: [],
    krk: data.rating,
    league: mapLeague('newbie'),
    inviteCode: '',
    activityHistory: [],
    createdAt: data.created_at,
  };
}
