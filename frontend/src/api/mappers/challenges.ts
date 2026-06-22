import type { Challenge, ChallengeStatus } from '@/types';

interface BackendChallenge {
  id: number;
  title: string;
  description?: string | null;
  reward_points: number;
  deadline?: string | null;
  created_at: string;
  is_active: boolean;
  completed_team_ids?: number[];
}

interface BackendChallengeList {
  challenges: BackendChallenge[];
  total: number;
}

export interface TeamChallengeEntry {
  id: number;
  challenge: BackendChallenge;
  team_id: number;
  status: 'active' | 'completed';
  enrolled_at: string;
  completed_at?: string | null;
  has_pending_report: boolean;
}

export interface MyChallengesResponse {
  challenges: TeamChallengeEntry[];
}

function mapStatus(challenge: BackendChallenge): ChallengeStatus {
  if (!challenge.is_active) return 'expired';
  if (challenge.deadline && new Date(challenge.deadline) < new Date()) return 'expired';
  return 'active';
}

export function mapChallenge(challenge: BackendChallenge): Challenge {
  return {
    id: String(challenge.id),
    title: challenge.title,
    description: challenge.description ?? '',
    points: challenge.reward_points,
    deadline: challenge.deadline ?? undefined,
    status: mapStatus(challenge),
    completedByTeamIds: (challenge.completed_team_ids ?? []).map(String),
    acceptsReport: true,
    createdAt: challenge.created_at,
  };
}

export function mapChallengeList(data: BackendChallengeList): Challenge[] {
  return data.challenges.map(mapChallenge);
}

export function mergeMyChallengeStatus(
  challenges: Challenge[],
  myChallenges: TeamChallengeEntry[],
  teamId: string,
): Challenge[] {
  const byChallengeId = new Map(
    myChallenges.map((entry) => [String(entry.challenge.id), entry]),
  );

  return challenges.map((challenge) => {
    const entry = byChallengeId.get(challenge.id);
    const completedByTeamIds = [...challenge.completedByTeamIds];
    if (entry?.status === 'completed' && !completedByTeamIds.includes(teamId)) {
      completedByTeamIds.push(teamId);
    }
    return {
      ...challenge,
      completedByTeamIds,
      teamStatus: entry?.status === 'completed'
        ? 'completed'
        : entry?.has_pending_report
          ? 'pending'
          : entry
            ? 'enrolled'
            : 'none',
    } as Challenge;
  });
}

export function toBackendChallengeCreate(data: {
  title: string;
  description: string;
  points: number;
  deadline?: string;
}) {
  return {
    title: data.title,
    description: data.description,
    reward_points: data.points,
    deadline: data.deadline ?? null,
  };
}
