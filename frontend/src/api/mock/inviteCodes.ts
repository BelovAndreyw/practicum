const STORAGE_KEY = 'practicum_mock_invite_codes';

export interface MockInviteOverride {
  inviteCode: string;
  inviteCodeUpdatedAt: string;
  inviteCodeExpiresAt: string;
}

function readAll(): Record<string, MockInviteOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MockInviteOverride>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getMockInviteOverride(teamId: string): MockInviteOverride | undefined {
  return readAll()[teamId];
}

export function setMockInviteOverride(teamId: string, data: MockInviteOverride): void {
  const all = readAll();
  all[teamId] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
