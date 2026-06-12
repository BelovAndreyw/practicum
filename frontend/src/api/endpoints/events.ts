import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';
import { MOCK_EVENTS } from '../mock/data';
import { mapEvent, mapEventList, toBackendEventCreate } from '../mappers/events';
import type { CalendarEvent } from '@/types';

const USE_MOCK = shouldUseMock();

export const eventsApi = {
  async list(): Promise<CalendarEvent[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_EVENTS; }
    const data = await http.get<Parameters<typeof mapEventList>[0]>('/events');
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

  async create(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'organizerId' | 'organizerName'>): Promise<CalendarEvent> {
    if (USE_MOCK) {
      await mockDelay();
      const event: CalendarEvent = {
        ...data,
        id: `ce${Date.now()}`,
        organizerId: 'u1',
        organizerName: 'Алексей Петров',
        createdAt: new Date().toISOString(),
      };
      MOCK_EVENTS.push(event);
      return event;
    }
    const created = await http.post<Parameters<typeof mapEvent>[0]>('/events', toBackendEventCreate(data));
    return mapEvent(created);
  },
};
