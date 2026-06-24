import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/api';
import { usersApi } from '@/api';
import { AUTH_UNAUTHORIZED_EVENT } from '@/api/client';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'email' | 'phone'>> & { avatarUrl?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const AUTH_USER_KEY = 'kz-auth-user';

function writeStoredUser(user: User | null) {
  try {
    if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // localStorage can be unavailable in private mode; auth still works in memory.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((freshUser) => {
        setUser(freshUser);
        writeStoredUser(freshUser);
      })
      .catch(() => {
        setUser(null);
        writeStoredUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Бэкенд вернул 401 (протух токен) — чисто сбрасываем сессию,
    // чтобы пользователя один раз перекинуло на логин, а не оставляло
    // с «висящим» аккаунтом и пустыми разделами.
    const onUnauthorized = () => {
      setUser(null);
      writeStoredUser(null);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const { user } = await authApi.login({ username, password });
    setUser(user);
    writeStoredUser(user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    writeStoredUser(null);
  };

  const refreshUser = async () => {
    const me = await authApi.me();
    setUser(me);
    writeStoredUser(me);
  };

  const updateProfile = async (data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'email' | 'phone'>> & { avatarUrl?: string | null }) => {
    if (!user) return;
    const updated = await usersApi.updateUser(user.id, data);
    setUser(updated);
    writeStoredUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
