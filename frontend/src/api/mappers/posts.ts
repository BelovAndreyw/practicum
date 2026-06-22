import { API_BASE } from '../client';
import type { NewsItem } from '@/types';

interface BackendPostAuthor {
  username: string;
  full_name: string;
}

interface BackendPostImage {
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  content_type: string;
  uploaded_at: string;
}

interface BackendPost {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: BackendPostAuthor;
  images?: BackendPostImage[];
}

interface BackendPostList {
  posts: BackendPost[];
  total: number;
}

function mapPostImages(post: BackendPost): NewsItem['images'] {
  return (post.images ?? []).map((img) => ({
    id: String(img.id),
    url: `${API_BASE}/posts/${post.id}/images/${img.id}`,
    filename: img.filename,
  }));
}

export function mapPost(post: BackendPost): NewsItem {
  return {
    id: String(post.id),
    title: post.title,
    body: post.content,
    authorId: post.author.username,
    authorName: post.author.full_name,
    publishedAt: post.created_at,
    images: mapPostImages(post),
  };
}

export function mapPostList(data: BackendPostList): NewsItem[] {
  return data.posts.map(mapPost);
}
