import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_NEWS } from '../mock/data';
import { mapPost, mapPostList } from '../mappers/posts';
import type { NewsItem } from '@/types';

const USE_MOCK = shouldUseMock();

export interface CreateNewsPayload {
  title: string;
  body: string;
  files?: File[];
}

export const newsApi = {
  async list(): Promise<NewsItem[]> {
    if (USE_MOCK) { await mockDelay(); return [...MOCK_NEWS].reverse(); }
    const data = await http.get<Parameters<typeof mapPostList>[0]>('/posts/');
    return mapPostList(data);
  },

  async create(data: CreateNewsPayload): Promise<NewsItem> {
    if (USE_MOCK) {
      await mockDelay();
      const images = (data.files ?? []).map((file, index) => ({
        id: `img${Date.now()}_${index}`,
        url: URL.createObjectURL(file),
        filename: file.name,
      }));
      const n: NewsItem = {
        title: data.title,
        body: data.body,
        id: `n${Date.now()}`,
        authorId: 'org1',
        authorName: 'Виктория Романова',
        publishedAt: new Date().toISOString(),
        images,
      };
      MOCK_NEWS.push(n);
      return n;
    }
    const form = new FormData();
    form.append('title', data.title);
    form.append('content', data.body);
    for (const file of data.files ?? []) {
      form.append('files', file);
    }
    const post = await http.postForm<Parameters<typeof mapPost>[0]>('/posts/', form);
    return mapPost(post);
  },
};
