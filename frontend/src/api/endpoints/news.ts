import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_NEWS } from '../mock/data';
import type { NewsItem } from '@/types';

const USE_MOCK = shouldUseMock();

export const newsApi = {
  async list(): Promise<NewsItem[]> {
    if (USE_MOCK) { await mockDelay(); return [...MOCK_NEWS].reverse(); }
    return http.get<NewsItem[]>('/news');
  },

  async create(data: Pick<NewsItem, 'title' | 'body'>): Promise<NewsItem> {
    if (USE_MOCK) {
      await mockDelay();
      const n: NewsItem = { ...data, id: `n${Date.now()}`, authorId: 'org1', authorName: 'Виктория Романова', publishedAt: new Date().toISOString() };
      MOCK_NEWS.push(n);
      return n;
    }
    return http.post<NewsItem>('/news', data);
  },
};
