import { http } from '../client';
import { mockDelay } from '../mock/delay';
import { MOCK_EVENTS } from '../mock/data';
import type { CalendarEvent } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const eventsApi = {
  async list(): Promise<CalendarEvent[]> {
    if (USE_MOCK) { await mockDelay(); return MOCK_EVENTS; }
    return http.get<CalendarEvent[]>('/events');
  },

  async get(id: string): Promise<CalendarEvent> {
    if (USE_MOCK) {
      await mockDelay();
      const event = MOCK_EVENTS.find((item) => item.id === id);
      if (!event) throw new Error('Event not found');
      return event;
    }
    return http.get<CalendarEvent>(`/events/${id}`);
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
    return http.post<CalendarEvent>('/events', data);
  },
};
