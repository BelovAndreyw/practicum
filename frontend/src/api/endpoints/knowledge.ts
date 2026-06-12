import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_KNOWLEDGE } from '../mock/data';
import {
  mapKnowledgeList,
  mapKnowledgeRequest,
  type BackendHelpDetail,
  type BackendHelpList,
} from '../mappers/help';
import type { KnowledgeRequest, KnowledgeRequestType } from '@/types';

const USE_MOCK = shouldUseMock();

function knowledgeTypeToHelpType(type: KnowledgeRequestType): string {
  return type === 'offer' ? 'offering' : 'receiving';
}

export const knowledgeApi = {
  async list(filter?: { type?: KnowledgeRequestType; resolved?: boolean }): Promise<KnowledgeRequest[]> {
    if (USE_MOCK) {
      await mockDelay();
      let list = MOCK_KNOWLEDGE;
      if (filter?.type) list = list.filter((k) => k.type === filter.type);
      if (filter?.resolved !== undefined) list = list.filter((k) => k.resolved === filter.resolved);
      return list;
    }

    const params = new URLSearchParams();
    if (filter?.resolved === false) params.set('status', 'open');
    if (filter?.resolved === true) params.set('status', 'fulfilled');
    if (filter?.type) params.set('help_type', knowledgeTypeToHelpType(filter.type));

    const query = params.toString();
    const data = await http.get<BackendHelpList>(`/help${query ? `?${query}` : ''}`);
    let list = mapKnowledgeList(data);
    if (filter?.type) list = list.filter((k) => k.type === filter.type);
    if (filter?.resolved !== undefined) list = list.filter((k) => k.resolved === filter.resolved);
    return list;
  },

  async create(data: Pick<KnowledgeRequest, 'type' | 'title' | 'description' | 'tags'>): Promise<KnowledgeRequest> {
    if (USE_MOCK) {
      await mockDelay();
      const k: KnowledgeRequest = { ...data, id: `kn${Date.now()}`, authorId: 'u1', authorName: 'Алексей Петров', teamId: 't1', teamName: 'Байты Знаний', resolved: false, createdAt: new Date().toISOString() };
      MOCK_KNOWLEDGE.push(k);
      return k;
    }
    const created = await http.post<BackendHelpList['requests'][0]>('/help', {
      title: data.title,
      description: data.description,
      help_type: knowledgeTypeToHelpType(data.type),
      format: 'both',
    });
    return mapKnowledgeRequest(created);
  },

  async resolve(id: string): Promise<void> {
    if (USE_MOCK) {
      await mockDelay();
      const k = MOCK_KNOWLEDGE.find((item) => item.id === id);
      if (k) k.resolved = true;
      return;
    }
    const detail = await http.get<BackendHelpDetail>(`/help/${id}`);
    const pending = detail.responses.find((r) => r.status === 'pending');
    if (pending) {
      await http.post(`/help/${id}/accept/${pending.id}`);
      return;
    }
    await http.post(`/help/${id}/cancel`);
  },
};
