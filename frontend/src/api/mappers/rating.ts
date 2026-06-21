import type { TeamRatingEntry, UserRatingEntry } from '@/types';
import { mapLeague } from './user';

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
  total_krk: number;
  global_rank: number;
  league: string;
  team_name?: string | null;
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
      krk: t.average_krk,
    },
  }));
}

export function mapUserRatingList(data: BackendLeaderboard): UserRatingEntry[] {
  // Бэкенд отдаёт только username (без ФИО), поэтому показываем его как есть,
  // не разбивая по пробелам (иначе имя дублировалось: «username username»).
  return data.rankings.map((r) => ({
    rank: r.global_rank,
    user: {
      id: String(r.user_id),
      firstName: r.username,
      lastName: '',
      personalRating: r.total_krk,
      league: mapLeague(r.league),
    },
    teamName: r.team_name ?? undefined,
  }));
}
