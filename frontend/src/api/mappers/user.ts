import type { User, UserRole, Achievement, KrkBreakdown } from '@/types';

export function mapBackendRole(role: string): UserRole {
  if (role === 'captain') return 'captain';
  if (role === 'teacher' || role === 'admin') return 'organizer';
  return 'student';
}

export function mapLeague(league?: string): string {
  const map: Record<string, string> = {
    newbie: 'Новичок',
    pro: 'Профи',
    legend: 'Легенда',
  };
  return league ? (map[league] ?? league) : '';
}

export interface BackendAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
}

export interface BackendUserResponse {
  id: number;
  username: string;
  student_id: number;
  full_name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  achievements?: BackendAchievement[];
}

export interface BackendMyRating {
  total_krk: number;
  base_score: number;
  unity_score: number;
  bonus_score: number;
  penalty_score: number;
  league: string;
}

function mapAchievements(items?: BackendAchievement[]): Achievement[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    unlockedAt: item.unlocked_at,
  }));
}

export function mapKrkBreakdown(rating: BackendMyRating): KrkBreakdown {
  return {
    baseRating: rating.base_score,
    cohesionCoeff: rating.unity_score,
    bonusCoeff: rating.bonus_score,
    total: rating.total_krk,
  };
}

export interface BackendUserProfileResponse extends BackendUserResponse {
  team_name?: string | null;
  team_id?: number | null;
}

export function mapBackendUser(
  data: BackendUserResponse,
  extras?: {
    teamId?: string;
    teamName?: string;
    personalRating?: number;
    league?: string;
    krkBreakdown?: KrkBreakdown;
  },
): User {
  const [lastName = '', firstName = '', middleName] = data.full_name.split(' ');
  return {
    id: String(data.id),
    firstName,
    lastName,
    middleName: middleName || undefined,
    email: data.email ?? (data.username || ''),
    phone: data.phone ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
    studentId: data.student_id ? String(data.student_id) : undefined,
    role: mapBackendRole(data.role),
    teamId: extras?.teamId,
    teamName: extras?.teamName,
    personalRating: extras?.personalRating ?? 0,
    league: extras?.league ?? '',
    krkBreakdown: extras?.krkBreakdown,
    achievements: mapAchievements(data.achievements),
    createdAt: new Date().toISOString(),
  };
}

export function splitFullName(fullName: string): { firstName: string; lastName: string; middleName?: string } {
  const [lastName = '', firstName = '', middleName] = fullName.split(' ');
  return { firstName, lastName, middleName: middleName || undefined };
}
