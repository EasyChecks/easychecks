/**
 * eventService.ts
 * ─────────────────────────────────────────
 * ทำไมต้องแยก service layer ออกจาก component?
 * - Event มีทั้งฝั่ง Admin (สร้าง/แก้/ลบ) และฝั่ง User (check-in/check-out)
 * - แยก service เพื่อให้ component ไม่สนใจเรื่อง API path
 * - ทุก component (ทั้ง admin/event-management และ user/events) ใช้ไฟล์เดียวกัน
 *
 * Base URL: /api/events
 * สิทธิ์: แล้วแต่ role ของ endpoint (authenticate middleware + authorizeRole)
 */

import api from './api';

// ── Types (ตรงกับ backend response) ──
// ทำไมต้องประกาศ type ที่ frontend?
// - กิจกรรมมี 2 โหมดสถานที่: locationId (Mode A) หรือ custom venue (Mode B)
// - participantType กำหนดว่าใครเข้าร่วม → type ต้องรองรับทุกกรณี

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
  branchId?: number;
}

export interface EventParticipant {
  user?: {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
  };
  branch?: {
    branchId: number;
    name: string;
  };
}

// ทำไม EventItem ต้องมี field เยอะขนาดนี้?
// - backend ส่ง response ต่างกันตาม endpoint (getAll vs getById ได้ detail ต่างกัน)
// - interface ตัวเดียวรวมทุก field เพื่อไม่ต้องสร้าง type แยก per-endpoint
// - optional fields (เช่น creator?, attendance?) มีเฉพาะ getById เท่านั้น
export interface EventItem {
  eventId: number;
  eventName: string;
  description?: string;
  locationId?: number | null;
  // custom venue (Mode B) — ใช้เมื่อสถานที่ไม่มีในระบบ (pin เองบนแผนที่)
  venueName?: string | null;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
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
  event_participants?: { branchId: number | null }[];
  attendance?: {
    attendanceId: number;
    checkIn: string;
    checkOut?: string | null;
    user: {
      userId: number;
      firstName: string;
      lastName: string;
      email?: string;
    };
  }[];
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

// ทำไมต้องมี CreateEventRequest แยกจาก UpdateEventRequest?
// - Create บังคับ required fields (eventName, startDateTime, endDateTime, participantType)
// - Update ส่งเฉพาะ field ที่ต้องการแก้ (partial update)
export interface CreateEventRequest {
  eventName: string;
  description?: string;
  // Mode A: ใช้ location ที่มีอยู่แล้วในระบบ (check-in location เดิม)
  locationId?: number;
  // Mode B: สถานที่ custom ที่ไม่มีในระบบ (admin pin เองบน map)
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
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
  locationId?: number | null;
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
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
  branchId?: number;
}

// ทำไม checkedIn/checkedOut เป็น boolean ไม่ใช้แค่ attendance?
// - UI ต้องตัดสินใจว่าจะแสดงปุ่มอะไร: Check-in / Check-out / เข้าร่วมแล้ว
// - boolean ตัดสินใจง่ายกว่าตรวจ attendance != null && checkOut != null
export interface EventAttendanceStatus {
  checkedIn: boolean;
  checkedOut: boolean;
  attendance: {
    attendanceId: number;
    checkIn: string;
    checkOut: string | null;
    checkInPhoto: string | null;
    checkOutPhoto: string | null;
    status: string;
  } | null;
}

// ── Service Methods ──
// แยกเป็น 2 กลุ่ม:
// 1) Admin CRUD: getAll, getStatistics, getById, create, update, delete
// 2) User Participation: getMy, checkIn, checkOut, getMyAttendance

export const eventService = {
  /**
   * GET /api/events - ดึงรายการกิจกรรมทั้งหมด (Admin)
   * ทำไมส่ง params ทั้งก้อน? เพราะ filter/search/pagination ทำฝั่ง backend
   *
   * SQL เบื้องหลัง:
   * SELECT * FROM events WHERE deleted_at IS NULL
   * AND (event_name ILIKE '%search%' OR description ILIKE '%search%')
   * ORDER BY created_at DESC LIMIT take OFFSET skip;
   */
  async getAll(params?: EventListParams): Promise<EventListResponse> {
    const res = await api.get('/events', { params });
    return res.data.data;
  },

  /**
   * GET /api/events/my - กิจกรรมของฉัน (User)
   * ทำไมแยก /my จาก getAll?
   * - getAll ดึงทั้งหมดสำหรับ admin, /my กรองเฉพาะที่ user นั้นมีสิทธิ์เข้าร่วม
   * - backend กรองตาม participantType (ALL/INDIVIDUAL/BRANCH/ROLE)
   */
  async getMy(): Promise<EventItem[]> {
    const res = await api.get('/events/my');
    return res.data.data;
  },

  /**
   * GET /api/events/statistics - สถิติกิจกรรม (Admin)
   * ทำไมต้อง endpoint แยก?
   * - หน้า event-management มี Stats Cards (จำนวนรวม/active/upcoming/ongoing)
   * - คำนวณฝั่ง backend ดีกว่า เพราะใช้ 7 parallel queries แล้ว cache
   */
  async getStatistics(): Promise<EventStatistics> {
    const res = await api.get('/events/statistics');
    return res.data.data;
  },

  /**
   * GET /api/events/:id - รายละเอียดกิจกรรม
   * ทำไมไม่ใช้ข้อมูลจาก getAll?
   * - getAll ส่งแค่ list (name, date, status) ไม่มี creator/participants detail
   * - getById ส่ง full detail (พร้อม attendance records, participant list)
   */
  async getById(id: number): Promise<EventItem> {
    const res = await api.get(`/events/${id}`);
    return res.data.data;
  },

  /**
   * POST /api/events - สร้างกิจกรรมใหม่ (Admin/SuperAdmin)
   * ทำไมไม่ส่ง isActive ตอนสร้าง? backend default isActive=true ให้อัตโนมัติ
   */
  async create(data: CreateEventRequest): Promise<EventItem> {
    const res = await api.post('/events', data);
    return res.data.data;
  },

  /**
   * PUT /api/events/:id - แก้ไขกิจกรรม (Admin/SuperAdmin)
   */
  async update(id: number, data: UpdateEventRequest): Promise<EventItem> {
    const res = await api.put(`/events/${id}`, data);
    return res.data.data;
  },

  /**
   * DELETE /api/events/:id - ลบกิจกรรม (Admin/SuperAdmin)
   * หมายเหตุ: backend ทำ HARD DELETE (ลบถาวร) ไม่ใช่ soft delete
   */
  async delete(id: number): Promise<EventItem> {
    const res = await api.delete(`/events/${id}`);
    return res.data.data;
  },

  // ── User Event Participation ──
  // ทำไมแยก check-in/check-out กิจกรรมออกจาก attendance กะงาน?
  // - กิจกรรมไม่มี concept มาสาย (status = ON_TIME เสมอ)
  // - GPS radius ไม่เหมือนกัน: Mode A ใช้ location.radius, Mode B ใช้ 500m ตายตัว

  /**
   * POST /api/events/:id/checkin - เข้าร่วมกิจกรรม
   * ทำไมต้องส่ง lat/lng?
   * - backend ตรวจระยะทาง GPS ว่าอยู่ในรัศมีที่อนุญาตหรือไม่ (fraud detection)
   * - ถ้าไม่ส่ง ก็ check-in ได้แต่ไม่ตรวจ GPS
   */
  async checkIn(eventId: number, data: { latitude?: number; longitude?: number; photo?: string; address?: string }) {
    const res = await api.post(`/events/${eventId}/checkin`, data);
    return res.data.data;
  },

  /**
   * POST /api/events/:id/checkout - ออกจากกิจกรรม
   * หมายเหตุ: Mode B (custom venue) ไม่ตรวจ GPS ตอน checkout
   */
  async checkOut(eventId: number, data: { latitude?: number; longitude?: number; photo?: string; address?: string }) {
    const res = await api.post(`/events/${eventId}/checkout`, data);
    return res.data.data;
  },

  /**
   * GET /api/events/:id/my-attendance - ดึงสถานะการเข้าร่วมของตัวเอง
   * ทำไม UI ต้องเรียก endpoint นี้?
   * - ตัดสินใจว่าจะแสดงปุ่ม Check-in / Check-out / "เข้าร่วมแล้ว"
   * - เรียกทุกครั้งที่เปิดหน้า event detail
   */
  async getMyAttendance(eventId: number): Promise<EventAttendanceStatus> {
    const res = await api.get(`/events/${eventId}/my-attendance`);
    return res.data.data;
  },
};

export default eventService;
