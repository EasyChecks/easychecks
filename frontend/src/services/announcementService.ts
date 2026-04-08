/**
 * ─────────────────────────────────────────────────────────────
 * 📢 announcementService.ts — HTTP client สำหรับระบบประกาศ
 * ─────────────────────────────────────────────────────────────
 * ทำหน้าที่: เรียก API ที่ backend แล้วคืน typed data ให้ component ใช้
 *
 * ทำไมต้องแยก service ออกมา?
 * → Component ไม่ต้องรู้เรื่อง HTTP method, URL, หรือ response wrapper
 *   แค่เรียก announcementService.getAll() แล้วได้ Announcement[] กลับมาเลย
 *
 * Base URL: /api/announcements (ต่อจาก api instance ที่ตั้ง baseURL ไว้แล้ว)
 * ─────────────────────────────────────────────────────────────
 */

import api from './api';
import type {
  Announcement,
  AnnouncementFilters,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO,
  SendAnnouncementResult,
} from '@/types/announcement';

// ── Helper: แกะ response wrapper ──
// API backend ห่อข้อมูลไว้ใน { data: { data: ... } }
// function นี้แกะชั้นในสุดออกมาให้ได้ data ตรงๆ
const unwrap = <T>(res: { data: unknown }): T => {
  const d = res.data as Record<string, unknown>;
  return (d?.data ?? d) as T;
};

const announcementService = {
  /** ดึงประกาศทั้งหมด (รองรับ filter ตาม status, createdByUserId) */
  getAll: async (filters?: AnnouncementFilters): Promise<Announcement[]> => {
    const res = await api.get('/announcements', { params: filters });
    return unwrap<Announcement[]>(res);
  },

  /** ดึงประกาศรายชิ้นตาม ID (พร้อมรายชื่อผู้รับ) */
  getById: async (id: number): Promise<Announcement> => {
    const res = await api.get(`/announcements/${id}`);
    return unwrap<Announcement>(res);
  },

  /** สร้างประกาศใหม่ (สถานะเริ่มต้นเป็น DRAFT เสมอ) */
  create: async (data: CreateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.post('/announcements', data);
    return unwrap<Announcement>(res);
  },

  /** แก้ไขประกาศ (แก้ได้เฉพาะ DRAFT เท่านั้น) */
  update: async (id: number, data: UpdateAnnouncementDTO): Promise<Announcement> => {
    const res = await api.put(`/announcements/${id}`, data);
    return unwrap<Announcement>(res);
  },

  /** ส่งประกาศ — เปลี่ยนสถานะเป็น SENT และสร้าง recipients + ส่งอีเมล */
  send: async (id: number): Promise<SendAnnouncementResult> => {
    const res = await api.post(`/announcements/${id}/send`);
    return unwrap<SendAnnouncementResult>(res);
  },

  /** ลบประกาศทั้งฉบับ (Hard Delete) */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/announcements/${id}`);
  },

  /** ลบผู้รับประกาศ 1 คน (เช่น ส่งผิดคน ต้อง revoke) */
  deleteRecipient: async (announcementId: number, recipientId: number): Promise<void> => {
    await api.delete(`/announcements/${announcementId}/recipients/${recipientId}`);
  },

  /** ล้างผู้รับประกาศทั้งหมด (เตรียม re-send ใหม่) */
  clearAllRecipients: async (announcementId: number): Promise<{ clearedCount: number }> => {
    const res = await api.delete(`/announcements/${announcementId}/recipients`);
    return unwrap<{ clearedCount: number }>(res);
  },
};

export default announcementService;
