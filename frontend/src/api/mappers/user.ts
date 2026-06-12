import type { User, UserRole } from '@/types';

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

export interface BackendUserResponse {
  id: number;
  username: string;
  student_id: number;
  full_name: string;
  role: string;
}

export interface BackendUserProfileResponse extends BackendUserResponse {
  team_name?: string | null;
  team_id?: number | null;
}

export function mapBackendUser(
  data: BackendUserResponse,
  extras?: { teamId?: string; personalRating?: number; league?: string },
): User {
  const [lastName = '', firstName = '', middleName] = data.full_name.split(' ');
  return {
    id: String(data.id),
    firstName,
    lastName,
    middleName: middleName || undefined,
    email: data.username,
    studentId: String(data.student_id),
    role: mapBackendRole(data.role),
    teamId: extras?.teamId,
    personalRating: extras?.personalRating ?? 0,
    league: extras?.league ?? '',
    achievements: [],
    createdAt: new Date().toISOString(),
  };
}

export function splitFullName(fullName: string): { firstName: string; lastName: string; middleName?: string } {
  const [lastName = '', firstName = '', middleName] = fullName.split(' ');
  return { firstName, lastName, middleName: middleName || undefined };
}
