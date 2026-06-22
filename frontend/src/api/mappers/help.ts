import type { KnowledgeRequest, RescueRequest, RescueStatus, KnowledgeRequestType } from '@/types';

export interface BackendHelpRequest {
  id: number;
  requesting_team_id: number;
  title: string;
  description?: string | null;
  help_type: string;
  status: string;
  created_at: string;
  fulfilled_by_team_id?: number | null;
  fulfilled_at?: string | null;
  responses_count?: number;
}

interface BackendHelpList {
  requests: BackendHelpRequest[];
  total: number;
}

interface BackendHelpResponse {
  id: number;
  responding_team_id: number;
  status: string;
}

interface BackendHelpDetail extends BackendHelpRequest {
  responses: BackendHelpResponse[];
}

function mapHelpStatusToRescue(status: string, responsesCount = 0): RescueStatus {
  if (status === 'fulfilled') return 'confirmed';
  if (status === 'cancelled') return 'rejected';
  if (status === 'in_progress') return 'accepted';
  if (status === 'open' && responsesCount > 0) return 'accepted';
  return 'pending';
}

function mapKnowledgeType(helpType: string): KnowledgeRequestType {
  if (helpType === 'offering' || helpType === 'providing') return 'offer';
  return 'need';
}

export function mapKnowledgeRequest(item: BackendHelpRequest, teamName?: string): KnowledgeRequest {
  return {
    id: String(item.id),
    type: mapKnowledgeType(item.help_type),
    title: item.title,
    description: item.description ?? undefined,
    tags: [],
    authorId: String(item.requesting_team_id),
    authorName: teamName ?? `Команда #${item.requesting_team_id}`,
    teamId: String(item.requesting_team_id),
    teamName: teamName ?? `Команда #${item.requesting_team_id}`,
    resolved: item.status === 'fulfilled' || item.status === 'cancelled',
    createdAt: item.created_at,
  };
}

export function mapRescueRequest(item: BackendHelpRequest, teamName?: string): RescueRequest {
  return {
    id: String(item.id),
    requesterTeamId: String(item.requesting_team_id),
    requesterTeamName: teamName ?? `Команда #${item.requesting_team_id}`,
    helperTeamId: item.fulfilled_by_team_id != null ? String(item.fulfilled_by_team_id) : undefined,
    topic: item.title,
    description: item.description ?? '',
    status: mapHelpStatusToRescue(item.status, item.responses_count ?? 0),
    bonusPoints: 40,
    createdAt: item.created_at,
    confirmedAt: item.fulfilled_at ?? undefined,
  };
}

export function mapKnowledgeList(data: BackendHelpList): KnowledgeRequest[] {
  return data.requests.map((r) => mapKnowledgeRequest(r));
}

export function mapRescueList(data: BackendHelpList): RescueRequest[] {
  return data.requests.map((r) => mapRescueRequest(r));
}

export type { BackendHelpDetail, BackendHelpList };
