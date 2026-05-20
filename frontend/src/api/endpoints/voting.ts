import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_VOTE_ROUNDS } from '../mock/data';
import type { VoteRound, VoteBallot } from '@/types';

const USE_MOCK = shouldUseMock();

export const votingApi = {
  async getActiveRound(teamId: string): Promise<VoteRound | null> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_VOTE_ROUNDS.find((r) => r.teamId === teamId && r.isOpen) ?? null;
    }
    return http.get<VoteRound | null>(`/voting/active?teamId=${teamId}`);
  },

  async submitBallot(ballot: Omit<VoteBallot, 'voterId'>): Promise<void> {
    if (USE_MOCK) { await mockDelay(600); return; }
    return http.post('/voting/ballots', ballot);
  },
};
