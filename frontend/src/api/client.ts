/**
 * HTTP-клиент. Все запросы к backend идут через эту обёртку.
 *
 * В mock-режиме (VITE_USE_MOCK=true) каждый endpoint-файл возвращает
 * заглушку вместо реального fetch — см. api/endpoints/*.ts.
 *
 * Для production: установите VITE_USE_MOCK=false в .env и задайте VITE_BACKEND_URL.
 */

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include', // JWT-cookie или session cookie
    ...init,
  });

  if (!res.ok) {
    let message = res.statusText;
    let details: Record<string, string> | undefined;
    try {
      const body = await res.json();
      message = body.message ?? message;
      details = body.details;
    } catch {
      // no json body
    }
    throw new ApiError(res.status, message, details);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const http = {
  get:    <T>(path: string)                   => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown)   => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)   => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
};
