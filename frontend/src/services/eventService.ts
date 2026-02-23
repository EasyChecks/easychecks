/**
 * eventService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Event API
 * Base URL: /api/events
 */

import api from './api';

// ── Types (ตรงกับ backend response) ──

export type ParticipantType = 'ALL' | 'INDIVIDUAL' | 'BRANCH' | 'ROLE';

export interface EventLocation {
  locationId: number;
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface EventCreator {
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
}

export interface EventParticipant {
  user?: {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch?: {
    branchId: number;
    name: string;
  };
}

export interface EventItem {
  eventId: number;
  eventName: string;
  description?: string;
  locationId?: number;
  participantType: ParticipantType;
  isActive: boolean;
  startDateTime: string;
  endDateTime: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
  location?: EventLocation;
  creator?: EventCreator;
  updatedBy?: EventCreator | null;
  deletedBy?: EventCreator | null;
  participants?: EventParticipant[];
  _count?: {
    event_participants?: number;
    attendance?: number;
    attendances?: number;
  };
}

export interface EventListResponse {
  data: EventItem[];
  total: number;
  active: number;
  inactive: number;
}

export interface EventStatistics {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  ongoingEvents: number;
  pastEvents: number;
  deletedEvents: number;
  byParticipantType: Array<{ type: ParticipantType; count: number }>;
}

export interface CreateEventRequest {
  eventName: string;
  description?: string;
  locationId: number;
  startDateTime: string;
  endDateTime: string;
  participantType: ParticipantType;
  participants?: {
    userIds?: number[];
    branchIds?: number[];
    roles?: string[];
  };
}

export interface UpdateEventRequest {
  eventName?: string;
  description?: string;
  locationId?: number;
  startDateTime?: string;
  endDateTime?: string;
  participantType?: ParticipantType;
  isActive?: boolean;
  participants?: {
    userIds?: number[];
    branchIds?: number[];
    roles?: string[];
  };
}

export interface EventListParams {
  search?: string;
  participantType?: ParticipantType;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  skip?: number;
  take?: number;
}

// ── Service Methods ──

export const eventService = {
  /**
   * GET /api/events - ดึงรายการกิจกรรมทั้งหมด (Admin)
   */
  async getAll(params?: EventListParams): Promise<EventListResponse> {
    const res = await api.get('/events', { params });
    return res.data.data;
  },

  /**
   * GET /api/events/my - กิจกรรมของฉัน (User)
   */
  async getMy(): Promise<EventItem[]> {
    const res = await api.get('/events/my');
    return res.data.data;
  },

  /**
   * GET /api/events/statistics - สถิติกิจกรรม (Admin)
   */
  async getStatistics(): Promise<EventStatistics> {
    const res = await api.get('/events/statistics');
    return res.data.data;
  },

  /**
   * GET /api/events/:id - รายละเอียดกิจกรรม
   */
  async getById(id: number): Promise<EventItem> {
    const res = await api.get(`/events/${id}`);
    return res.data.data;
  },

  /**
   * POST /api/events - สร้างกิจกรรมใหม่ (Admin/SuperAdmin)
   */
  async create(data: CreateEventRequest): Promise<EventItem> {
    const res = await api.post('/events', data);
    return res.data.data;
  },

  /**
   * PATCH /api/events/:id - แก้ไขกิจกรรม (Admin/SuperAdmin)
   */
  async update(id: number, data: UpdateEventRequest): Promise<EventItem> {
    const res = await api.patch(`/events/${id}`, data);
    return res.data.data;
  },

  /**
   * DELETE /api/events/:id - ลบกิจกรรม Soft Delete (Admin/SuperAdmin)
   */
  async delete(id: number, deleteReason: string): Promise<EventItem> {
    const res = await api.delete(`/events/${id}`, { data: { deleteReason } });
    return res.data.data;
  },

  /**
   * POST /api/events/:id/restore - กู้คืนกิจกรรม (Admin/SuperAdmin)
   */
  async restore(id: number): Promise<EventItem> {
    const res = await api.post(`/events/${id}/restore`);
    return res.data.data;
  },
};

export default eventService;
