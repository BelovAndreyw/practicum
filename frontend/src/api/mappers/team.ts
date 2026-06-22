import type { Team, TeamMember, KrkBreakdown, UserRole } from '@/types';
import { mapLeague, splitFullName } from './user';

export interface BackendTeamSummary {
  id: number;
  name: string;
  description?: string | null;
  captain_id: number;
  captain_name?: string | null;
  members_count: number;
  members?: BackendTeamMember[];
  rating?: number;
  created_at: string;
}

export interface BackendTeamMember {
  user_id: number;
  username: string;
  full_name: string;
  joined_at: string;
  personal_krk?: number;
  league?: string | null;
}

export interface BackendTeamDetail extends BackendTeamSummary {
  members: BackendTeamMember[];
  average_krk?: number;
  invite_code?: string | null;
  invite_expires_at?: string | null;
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
  is_active?: boolean;
}

function roundKrk(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapMember(member: BackendTeamMember, captainId: number): TeamMember {
  const { firstName, lastName } = splitFullName(member.full_name);
  const role: UserRole = member.user_id === captainId ? 'captain' : 'student';
  return {
    userId: String(member.user_id),
    firstName,
    lastName,
    role,
    personalRating: roundKrk(member.personal_krk ?? 0),
  };
}

export function mapTeamSummary(data: BackendTeamSummary, krk?: number, league = ''): Team {
  const detailKrk = 'average_krk' in data ? (data as BackendTeamDetail).average_krk : undefined;
  const teamKrk = roundKrk(krk ?? detailKrk ?? 0);
  const members = data.members && data.members.length > 0
    ? data.members.map((m) => mapMember(m, data.captain_id))
    : Array.from({ length: data.members_count }, (_, index) => ({
        userId: `${data.id}-m${index}`,
        firstName: '',
        lastName: '',
        role: 'student' as const,
        personalRating: 0,
      }));
  return {
    id: String(data.id),
    name: data.name,
    captainId: String(data.captain_id),
    members,
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
    inviteCode: data.invite_code ?? '',
    inviteCodeExpiresAt: data.invite_expires_at ?? undefined,
  };
}

export function mapKrkFromRating(rating: number): KrkBreakdown {
  const base = rating * 0.6;
  const cohesion = rating * 0.3;
  const bonus = rating * 0.1;
  return {
    baseRating: +base.toFixed(2),
    cohesionCoeff: +cohesion.toFixed(2),
    bonusCoeff: +bonus.toFixed(2),
    total: roundKrk(rating),
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
