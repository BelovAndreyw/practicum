import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_VOTE_ROUNDS } from '../mock/data';
import { ApiError } from '../client';
import type { VoteRound, VoteBallot } from '@/types';

const USE_MOCK = shouldUseMock();

export const votingApi = {
  async getActiveRound(teamId: string): Promise<VoteRound | null> {
    if (USE_MOCK) {
      await mockDelay();
      return MOCK_VOTE_ROUNDS.find((r) => r.teamId === teamId && r.isOpen) ?? null;
    }
    return null;
  },

  async submitBallot(_ballot: Omit<VoteBallot, 'voterId'>): Promise<void> {
    if (USE_MOCK) { await mockDelay(600); return; }
    throw new ApiError(501, 'Голосование пока недоступно на сервере');
  },
};
