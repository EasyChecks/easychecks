// แยก HTTP client ออกจาก component เพื่อไม่ต้องรู้ HTTP method / URL / response shape
// component แค่เรียก announcementService.getAll() ก็ได้ Announcement[] กลับมาเลย

import api from './api';
import type {
  Announcement,
  AnnouncementFilters,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO,
  SendAnnouncementResult,
} from '@/types/announcement';

// แกะ response wrapper 2 ชั้น { data: { data: ... } } ของ backend
// เพื่อให้ caller ได้ data ตรงๆ ไม่ต้อง res.data.data ทุกที่
const unwrap = <T>(res: { data: unknown }): T => {
  const d = res.data as Record<string, unknown>;
  return (d?.data ?? d) as T;
};

const announcementService = {
  getAll: async (filters?: AnnouncementFilters): Promise<Announcement[]> => {
    const res = await api.get('/announcements', { params: filters });
    return unwrap<Announcement[]>(res);
  },

  getById: async (id: number): Promise<Announcement> => {
    const res = await api.get(`/announcements/${id}`);
    return unwrap<Announcement>(res);
  },

  create: async (data: CreateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.post('/announcements', data);
    return unwrap<Announcement>(res);
  },

  // แก้ได้เฉพาะ DRAFT — backend จะ reject ถ้าประกาศเป็น SENT แล้ว
  update: async (id: number, data: UpdateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.put(`/announcements/${id}`, data);
    return unwrap<Announcement>(res);
  },

  // เปลี่ยน DRAFT → SENT + สร้าง recipients + ส่งอีเมล fire-and-forget
  send: async (id: number): Promise<SendAnnouncementResult> => {
    const res = await api.post(`/announcements/${id}/send`);
    return unwrap<SendAnnouncementResult>(res);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/announcements/${id}`);
  },

  // revoke ผู้รับ 1 คน เช่นส่งผิดคน
  deleteRecipient: async (announcementId: number, recipientId: number): Promise<void> => {
    await api.delete(`/announcements/${announcementId}/recipients/${recipientId}`);
  },

  // ล้างทั้งหมดก่อน re-send ใหม่ เพื่อไม่ให้ duplicate
  clearAllRecipients: async (announcementId: number): Promise<{ clearedCount: number }> => {
    const res = await api.delete(`/announcements/${announcementId}/recipients`);
    return unwrap<{ clearedCount: number }>(res);
  },
};

export default announcementService;
