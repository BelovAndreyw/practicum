import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_KNOWLEDGE } from '../mock/data';
import type { KnowledgeRequest, KnowledgeRequestType } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const knowledgeApi = {
  async list(filter?: { type?: KnowledgeRequestType; resolved?: boolean }): Promise<KnowledgeRequest[]> {
    if (USE_MOCK) {
      await mockDelay();
      let list = MOCK_KNOWLEDGE;
      if (filter?.type) list = list.filter((k) => k.type === filter.type);
      if (filter?.resolved !== undefined) list = list.filter((k) => k.resolved === filter.resolved);
      return list;
    }
    const params = new URLSearchParams(filter as Record<string, string>).toString();
    return http.get<KnowledgeRequest[]>(`/knowledge${params ? `?${params}` : ''}`);
  },

  async create(data: Pick<KnowledgeRequest, 'type' | 'title' | 'description' | 'tags'>): Promise<KnowledgeRequest> {
    if (USE_MOCK) {
      await mockDelay();
      const k: KnowledgeRequest = { ...data, id: `kn${Date.now()}`, authorId: 'u1', authorName: 'Алексей Петров', teamId: 't1', teamName: 'Байты Знаний', resolved: false, createdAt: new Date().toISOString() };
      MOCK_KNOWLEDGE.push(k);
      return k;
    }
    return http.post<KnowledgeRequest>('/knowledge', data);
  },

  async resolve(id: string): Promise<void> {
    if (USE_MOCK) {
      await mockDelay();
      const k = MOCK_KNOWLEDGE.find((k) => k.id === id);
      if (k) k.resolved = true;
      return;
    }
    return http.patch(`/knowledge/${id}/resolve`);
  },
};
