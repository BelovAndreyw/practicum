import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/api';
import { usersApi } from '@/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'email' | 'phone' | 'avatarUrl'>>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const AUTH_USER_KEY = 'kz-auth-user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

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
    const storedUser = readStoredUser();
    if (storedUser) setUser(storedUser);

    authApi.me()
      .then((freshUser) => {
        setUser(freshUser);
        writeStoredUser(freshUser);
      })
      .catch(() => {
        if (!storedUser) setUser(null);
      })
      .finally(() => setLoading(false));
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

  const updateProfile = async (data: Partial<Pick<User, 'firstName' | 'lastName' | 'middleName' | 'email' | 'phone' | 'avatarUrl'>>) => {
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
