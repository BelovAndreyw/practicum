import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_EVENTS } from '../mock/data';
import { mapEvent, mapEventList, toBackendEventCreate, toBackendEventUpdate } from '../mappers/events';
import type { CalendarEvent } from '@/types';

const USE_MOCK = shouldUseMock();
type EventCreateData = Omit<CalendarEvent, 'id' | 'createdAt' | 'organizerId' | 'organizerName'>
  & Partial<Pick<CalendarEvent, 'organizerId' | 'organizerName'>>
  & { teamId?: string };

export const eventsApi = {
  async list(teamId?: string): Promise<CalendarEvent[]> {
    if (USE_MOCK) {
      await mockDelay();
      if (teamId) return MOCK_EVENTS.filter((e) => e.invitedTeamIds.includes(teamId));
      return MOCK_EVENTS;
    }
    const query = teamId ? `?team_id=${teamId}` : '';
    const data = await http.get<Parameters<typeof mapEventList>[0]>(`/events${query}`);
    return mapEventList(data);
  },

  async get(id: string): Promise<CalendarEvent> {
    if (USE_MOCK) {
      await mockDelay();
      const event = MOCK_EVENTS.find((item) => item.id === id);
      if (!event) throw new Error('Event not found');
      return event;
    }
    const data = await http.get<Parameters<typeof mapEvent>[0]>(`/events/${id}`);
    return mapEvent(data);
  },

  async create(data: EventCreateData): Promise<CalendarEvent> {
    if (USE_MOCK) {
      await mockDelay();
      const event: CalendarEvent = {
        ...data,
        id: `ce${Date.now()}`,
        organizerId: data.organizerId ?? 'u1',
        organizerName: data.organizerName ?? 'Алексей Петров',
        createdAt: new Date().toISOString(),
      };
      MOCK_EVENTS.push(event);
      return event;
    }
    const created = await http.post<Parameters<typeof mapEvent>[0]>('/events', toBackendEventCreate(data));
    return mapEvent(created);
  },

  async update(
    id: string,
    data: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'organizerId' | 'organizerName'>>,
  ): Promise<CalendarEvent> {
    if (USE_MOCK) {
      await mockDelay();
      const index = MOCK_EVENTS.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Event not found');
      MOCK_EVENTS[index] = { ...MOCK_EVENTS[index], ...data };
      return MOCK_EVENTS[index];
    }
    const updated = await http.patch<Parameters<typeof mapEvent>[0]>(`/events/${id}`, toBackendEventUpdate(data));
    return mapEvent(updated);
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      await mockDelay();
      const index = MOCK_EVENTS.findIndex((item) => item.id === id);
      if (index >= 0) MOCK_EVENTS.splice(index, 1);
      return;
    }
    return http.delete<void>(`/events/${id}`);
  },
};
