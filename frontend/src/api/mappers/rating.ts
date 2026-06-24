import type { TeamRatingEntry, UserRatingEntry } from '@/types';
import { mapLeague, splitFullName } from './user';

interface BackendTeamRating {
  team_id: number;
  team_name: string;
  average_krk: number;
  global_rank: number;
  league?: string;
}

interface BackendTeamLeaderboard {
  teams: BackendTeamRating[];
  total: number;
}

interface BackendRankingItem {
  user_id: number;
  username: string;
  full_name?: string | null;
  total_krk: number;
  global_rank: number;
  league: string;
  team_name?: string | null;
  team_id?: number | null;
}

interface BackendLeaderboard {
  rankings: BackendRankingItem[];
  total: number;
}

export function mapTeamRatingList(data: BackendTeamLeaderboard): TeamRatingEntry[] {
  return data.teams.map((t) => ({
    rank: t.global_rank,
    team: {
      id: String(t.team_id),
      name: t.team_name,
      league: mapLeague(t.league),
      krk: roundKrk(t.average_krk),
    },
  }));
}

export function mapUserRatingList(data: BackendLeaderboard): UserRatingEntry[] {
  return data.rankings.map((r) => {
    const { firstName, lastName } = r.full_name
      ? splitFullName(r.full_name.trim())
      : { firstName: r.username, lastName: '' };
    return {
      rank: r.global_rank,
      user: {
        id: String(r.user_id),
        firstName,
        lastName,
        username: r.username,
        personalRating: roundKrk(r.total_krk),
        league: mapLeague(r.league),
      },
      teamName: r.team_name ?? undefined,
      teamId: r.team_id != null ? String(r.team_id) : undefined,
    };
  });
}

function roundKrk(value: number): number {
  return Math.round(value * 100) / 100;
}
