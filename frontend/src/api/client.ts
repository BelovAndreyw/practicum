/**
 * HTTP-клиент. Все запросы к backend идут через эту обёртку.
 *
 * В mock-режиме (VITE_USE_MOCK=true) каждый endpoint-файл возвращает
 * заглушку вместо реального fetch — см. api/endpoints/*.ts.
 *
 * Для production: установите VITE_USE_MOCK=false в .env и задайте VITE_BACKEND_URL.
 */

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

const TOKEN_KEY = 'access_token';

/** Событие, на которое подписывается AuthContext, чтобы чисто завершить сессию при 401. */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Бэкенд хранит время в naive UTC и сериализует его без суффикса `Z`.
 * Браузер же трактует такую ISO-строку как локальное время, из-за чего
 * время «уезжает» на величину смещения часового пояса (баг срока инвайта).
 * Здесь рекурсивно дописываем `Z` ко всем датам без таймзоны, чтобы фронт
 * корректно конвертировал UTC в локальное время во всех местах сразу.
 */
const TZ_LESS_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function normalizeDatetimes<T>(value: T): T {
  if (typeof value === 'string') {
    return (TZ_LESS_ISO.test(value) ? `${value}Z` : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDatetimes(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeDatetimes(val);
    }
    return out as unknown as T;
  }
  return value;
}

function parseErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.detail === 'string') return record.detail;
  if (Array.isArray(record.detail)) {
    return record.detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return null;
      })
      .filter(Boolean)
      .join('; ') || fallback;
  }
  return fallback;
}

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
  const token = getAuthToken();
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let message = res.statusText;
    let details: Record<string, string> | undefined;
    try {
      const body = await res.json();
      message = parseErrorMessage(body, message);
      if (body && typeof body === 'object' && 'details' in body) {
        details = (body as { details?: Record<string, string> }).details;
      }
    } catch {
      // no json body
    }
    // Токен протух или недействителен — чисто завершаем сессию,
    // чтобы UI не оставался в «полу-залогиненном» состоянии с пустыми списками.
    if (res.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }
    throw new ApiError(res.status, message, details);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  return normalizeDatetimes(data);
}

export const http = {
  get:    <T>(path: string)                   => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  put:    <T>(path: string, body?: unknown)   => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)   => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
};

export async function openAuthenticatedFile(path: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers, credentials: 'include' });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = parseErrorMessage(body, message);
    } catch {
      // no json body
    }
    if (res.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new ApiError(0, 'Не удалось открыть файл. Разрешите всплывающие окна в браузере.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
