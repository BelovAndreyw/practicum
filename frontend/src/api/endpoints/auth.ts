import { http, setAuthToken } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_ME, MOCK_USERS } from '../mock/data';
import type { User, UserRole } from '@/types';

const USE_MOCK = shouldUseMock();

export interface LoginPayload { username: string; password: string; }
export interface AuthResponse  { user: User; token: string; }

interface BackendLoginResponse {
  access_token: string;
  token_type?: string;
}

interface BackendUserResponse {
  username: string;
  student_id: number;
  full_name: string;
  role: string;
}

function mapBackendRole(role: string): UserRole {
  if (role === 'captain') return 'captain';
  if (role === 'teacher' || role === 'admin') return 'organizer';
  return 'student';
}

function mapBackendUser(data: BackendUserResponse): User {
  const [lastName = '', firstName = '', middleName] = data.full_name.split(' ');
  return {
    id: String(data.student_id),
    firstName,
    lastName,
    middleName: middleName || undefined,
    email: data.username,
    studentId: String(data.student_id),
    role: mapBackendRole(data.role),
    personalRating: 0,
    league: '',
    achievements: [],
    createdAt: new Date().toISOString(),
  };
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await mockDelay();
      const found = MOCK_USERS.find((u) => u.email === payload.username) ?? MOCK_ME;
      return { user: found, token: 'mock-jwt-token' };
    }

    const data = await http.post<BackendLoginResponse>('/auth/login', payload);
    setAuthToken(data.access_token);
    const user = await authApi.me();
    return { user, token: data.access_token };
  },

  async logout(): Promise<void> {
    if (USE_MOCK) { await mockDelay(100); return; }
    setAuthToken(null);
  },

  async me(): Promise<User> {
    if (USE_MOCK) { await mockDelay(200); return MOCK_ME; }
    const data = await http.get<BackendUserResponse>('/auth/me');
    return mapBackendUser(data);
  },
};
