import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_VOTE_ROUNDS } from '../mock/data';
import type { VoteRound } from '@/types';

const USE_MOCK = shouldUseMock();

interface BackendVoteRound {
  id: number;
  team_id: number;
  cycle_label: string;
  is_open: boolean;
  closes_at: string;
  has_voted: boolean;
}

function mapRound(data: BackendVoteRound): VoteRound {
  return {
    id: String(data.id),
    teamId: String(data.team_id),
    cycleLabel: data.cycle_label,
    isOpen: data.is_open,
    closesAt: data.closes_at,
    hasVoted: data.has_voted,
  };
}

export const votingApi = {
  async getActiveRound(teamId: string): Promise<VoteRound | null> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_VOTE_ROUNDS.find((r) => r.teamId === teamId && r.isOpen) ?? null;
    }
    const data = await http.get<BackendVoteRound | null>(`/voting/active?teamId=${teamId}`);
    if (!data) return null;
    return mapRound(data);
  },

  async submitBallots(
    roundId: string,
    ballots: { targetUserId: string; score: number }[],
  ): Promise<void> {
    if (USE_MOCK) {
      await mockDelay(600);
      return;
    }
    await http.post('/voting/ballots', {
      round_id: Number(roundId),
      ballots: ballots.map((b) => ({
        target_user_id: Number(b.targetUserId),
        score: b.score,
      })),
    });
  },

  async openRound(data: {
    teamId: string;
    cycleLabel: string;
    closesAt: string;
  }): Promise<VoteRound> {
    if (USE_MOCK) {
      await mockDelay();
      const round: VoteRound = {
        id: `vr${Date.now()}`,
        teamId: data.teamId,
        cycleLabel: data.cycleLabel,
        isOpen: true,
        closesAt: data.closesAt,
        hasVoted: false,
      };
      MOCK_VOTE_ROUNDS.push(round);
      return round;
    }
    const created = await http.post<BackendVoteRound>('/voting/rounds', {
      team_id: Number(data.teamId),
      cycle_label: data.cycleLabel,
      closes_at: data.closesAt,
    });
    return mapRound(created);
  },

  async closeRound(roundId: string): Promise<void> {
    if (USE_MOCK) {
      await mockDelay();
      const round = MOCK_VOTE_ROUNDS.find((r) => r.id === roundId);
      if (round) round.isOpen = false;
      return;
    }
    await http.post(`/voting/rounds/${roundId}/close`);
  },
};
