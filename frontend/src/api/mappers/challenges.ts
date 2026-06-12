import type { Challenge, ChallengeStatus } from '@/types';

interface BackendChallenge {
  id: number;
  title: string;
  description?: string | null;
  reward_points: number;
  deadline?: string | null;
  created_at: string;
  is_active: boolean;
}

interface BackendChallengeList {
  challenges: BackendChallenge[];
  total: number;
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
    completedByTeamIds: [],
    acceptsReport: true,
    createdAt: challenge.created_at,
  };
}

export function mapChallengeList(data: BackendChallengeList): Challenge[] {
  return data.challenges.map(mapChallenge);
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
