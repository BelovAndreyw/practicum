import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_NEWS } from '../mock/data';
import { mapPost, mapPostList } from '../mappers/posts';
import type { NewsItem } from '@/types';

const USE_MOCK = shouldUseMock();

export const newsApi = {
  async list(): Promise<NewsItem[]> {
    if (USE_MOCK) { await mockDelay(); return [...MOCK_NEWS].reverse(); }
    const data = await http.get<Parameters<typeof mapPostList>[0]>('/posts/');
    return mapPostList(data);
  },

  async create(data: Pick<NewsItem, 'title' | 'body'>): Promise<NewsItem> {
    if (USE_MOCK) {
      await mockDelay();
      const n: NewsItem = { ...data, id: `n${Date.now()}`, authorId: 'org1', authorName: 'Виктория Романова', publishedAt: new Date().toISOString() };
      MOCK_NEWS.push(n);
      return n;
    }
    const form = new FormData();
    form.append('title', data.title);
    form.append('content', data.body);
    const post = await http.postForm<Parameters<typeof mapPost>[0]>('/posts/', form);
    return mapPost(post);
  },
};
