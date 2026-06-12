import type { NewsItem } from '@/types';

interface BackendPostAuthor {
  username: string;
  full_name: string;
}

interface BackendPost {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: BackendPostAuthor;
}

interface BackendPostList {
  posts: BackendPost[];
  total: number;
}

export function mapPost(post: BackendPost): NewsItem {
  return {
    id: String(post.id),
    title: post.title,
    body: post.content,
    authorId: post.author.username,
    authorName: post.author.full_name,
    publishedAt: post.created_at,
  };
}

export function mapPostList(data: BackendPostList): NewsItem[] {
  return data.posts.map(mapPost);
}
