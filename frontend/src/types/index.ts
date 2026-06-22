// в”Ђв”Ђв”Ђ Р РѕР»Рё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type UserRole = 'student' | 'captain' | 'organizer';

export type League = string;

// в”Ђв”Ђв”Ђ РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  studentId?: string; // РЅРѕРјРµСЂ СЃС‚СѓРґРµРЅС‡РµСЃРєРѕРіРѕ Р±РёР»РµС‚Р° / РЈСЂР¤РЈ login
  avatarUrl?: string;
  role: UserRole;
  teamId?: string;
  personalRating: number;
  league: League;
  krkBreakdown?: KrkBreakdown;
  achievements: Achievement[];
  createdAt: string; // ISO date
}

// в”Ђв”Ђв”Ђ Р”РѕСЃС‚РёР¶РµРЅРёСЏ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji РёР»Рё РЅР°Р·РІР°РЅРёРµ РёРєРѕРЅРєРё
  unlockedAt: string; // ISO date
}

// в”Ђв”Ђв”Ђ РљРѕРјР°РЅРґР° в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface Team {
  id: string;
  name: string;
  captainId: string;
  members: TeamMember[];
  krk: number; // РљРѕРјР°РЅРґРЅС‹Р№ Р РµР№С‚РёРЅРіРѕРІС‹Р№ РљРѕСЌС„С„РёС†РёРµРЅС‚
  league: League;
  inviteCode: string;
  inviteCodeUpdatedAt?: string;
  inviteCodeExpiresAt?: string;
  activityHistory: ActivityEvent[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  personalRating: number;
}

// в”Ђв”Ђв”Ђ Р РµР№С‚РёРЅРіРё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface TeamRatingEntry {
  rank: number;
  team: Pick<Team, 'id' | 'name' | 'league' | 'krk'>;
}

export interface UserRatingEntry {
  rank: number;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'personalRating' | 'league'>;
  teamId?: string;
  teamName?: string;
  stream?: string;
}

// в”Ђв”Ђв”Ђ РљР Рљ (СЂР°СЃС€РёС„СЂРѕРІРєР° РєРѕРјРїРѕРЅРµРЅС‚РѕРІ) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface KrkBreakdown {
  baseRating: number;     // 60%
  cohesionCoeff: number;  // 30%
  bonusCoeff: number;     // 10%
  total: number;
}

// в”Ђв”Ђв”Ђ Р›РµРЅС‚Р° Р°РєС‚РёРІРЅРѕСЃС‚РµР№ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type ActivityEventType =
  | 'achievement_unlocked'
  | 'challenge_completed'
  | 'rating_updated'
  | 'team_joined'
  | 'rescue_completed'
  | 'event_created'
  | 'checkin_submitted';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  actorId?: string;
  actorName?: string;
  teamId?: string;
  teamName?: string;
  createdAt: string;
}

// в”Ђв”Ђв”Ђ Р§РµР»Р»РµРЅРґР¶Рё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type ChallengeStatus = 'active' | 'completed' | 'expired';

export type TeamChallengeStatus = 'none' | 'enrolled' | 'pending' | 'completed';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  points: number;
  deadline?: string; // ISO date
  status: ChallengeStatus;
  completedByTeamIds: string[];
  teamStatus?: TeamChallengeStatus;
  acceptsReport: boolean; // загрузка файлов/фото
  createdAt: string;
}

export interface ChallengeReport {
  challengeId: string;
  teamId: string;
  comment: string;
  fileUrls: string[];
  submittedAt: string;
}

// в”Ђв”Ђв”Ђ РЎРѕР±С‹С‚РёСЏ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type EventFormat = 'online' | 'offline';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  format: EventFormat;
  date: string; // ISO date
  location?: string;
  onlineLink?: string;
  organizerId: string;
  organizerName: string;
  invitedTeamIds: string[];
  createdAt: string;
}

// в”Ђв”Ђв”Ђ РќРѕРІРѕСЃС‚Рё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  publishedAt: string;
}

// в”Ђв”Ђв”Ђ Р‘РёСЂР¶Р° Р·РЅР°РЅРёР№ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type KnowledgeRequestType = 'need' | 'offer';

export interface KnowledgeRequest {
  id: string;
  type: KnowledgeRequestType;
  title: string;       // РЅР°РїСЂ. В«РС‰РµРј СЌРєСЃРїРµСЂС‚Р° РїРѕ JavaВ»
  description?: string;
  tags: string[];
  authorId: string;
  authorName: string;
  teamId?: string;
  teamName?: string;
  resolved: boolean;
  responsesCount?: number;
  createdAt: string;
}

// в”Ђв”Ђв”Ђ Check-in в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface CheckIn {
  id: string;
  teamId: string;
  weekLabel: string; // РЅР°РїСЂ. В«РќРµРґРµР»СЏ 3В»
  summary: string;
  achievements: string;
  blockers?: string;
  submittedAt: string;
  submittedByUserId: string;
}

// в”Ђв”Ђв”Ђ РЎРїР°СЃРµРЅРёРµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type RescueStatus = 'pending' | 'accepted' | 'confirmed' | 'rejected';

export interface RescueRequest {
  id: string;
  requesterTeamId: string;
  requesterTeamName: string;
  helperTeamId?: string;
  helperTeamName?: string;
  topic: string;
  description: string;
  status: RescueStatus;
  bonusPoints: number;
  createdAt: string;
  confirmedAt?: string;
}

// в”Ђв”Ђв”Ђ РђРЅРѕРЅРёРјРЅРѕРµ РіРѕР»РѕСЃРѕРІР°РЅРёРµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface VoteRound {
  id: string;
  teamId: string;
  cycleLabel: string;
  isOpen: boolean;
  closesAt: string;
  hasVoted?: boolean;
}

export interface VoteBallot {
  roundId: string;
  voterId: string;       // СЃРєСЂС‹С‚ РѕС‚ РґСЂСѓРіРёС… СѓС‡Р°СЃС‚РЅРёРєРѕРІ
  targetUserId: string;
  score: number;         // 1вЂ“5
}

// в”Ђв”Ђв”Ђ РћР±С‰РёРµ РѕР±С‘СЂС‚РєРё API в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, string>;
}
