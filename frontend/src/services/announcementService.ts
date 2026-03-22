/**
 * announcementService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Announcement API
 * Base URL: /api/announcements
 */

import api from './api';
import type {
  Announcement,
  AnnouncementFilters,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO,
  SendAnnouncementResult,
} from '@/types/announcement';

// ── Helper: unwrap API wrapper ──
const unwrap = <T>(res: { data: unknown }): T => {
  const d = res.data as Record<string, unknown>;
  return (d?.data ?? d) as T;
};

const announcementService = {
  /** GET /announcements */
  getAll: async (filters?: AnnouncementFilters): Promise<Announcement[]> => {
    const res = await api.get('/announcements', { params: filters });
    return unwrap<Announcement[]>(res);
  },

  /** GET /announcements/:id */
  getById: async (id: number): Promise<Announcement> => {
    const res = await api.get(`/announcements/${id}`);
    return unwrap<Announcement>(res);
  },

  /** POST /announcements */
  create: async (data: CreateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.post('/announcements', data);
    return unwrap<Announcement>(res);
  },

  /** PUT /announcements/:id */
  update: async (id: number, data: UpdateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.put(`/announcements/${id}`, data);
    return unwrap<Announcement>(res);
  },

  /** POST /announcements/:id/send */
  send: async (id: number): Promise<SendAnnouncementResult> => {
    const res = await api.post(`/announcements/${id}/send`);
    return unwrap<SendAnnouncementResult>(res);
  },

  /** DELETE /announcements/:id */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/announcements/${id}`);
  },

  /** DELETE /announcements/:announcementId/recipients/:recipientId */
  deleteRecipient: async (announcementId: number, recipientId: number): Promise<void> => {
    await api.delete(`/announcements/${announcementId}/recipients/${recipientId}`);
  },

  /** DELETE /announcements/:announcementId/recipients */
  clearAllRecipients: async (announcementId: number): Promise<{ clearedCount: number }> => {
    const res = await api.delete(`/announcements/${announcementId}/recipients`);
    return unwrap<{ clearedCount: number }>(res);
  },
};

export default announcementService;
