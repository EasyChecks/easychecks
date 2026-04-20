/**
 * dashboardService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Dashboard API
 * Base URL: /api/dashboard
 * สิทธิ์: ADMIN / SUPERADMIN เท่านั้น
 */

import api from './api';

// ── Types (ตรงกับ backend response) ──

export interface AttendanceSummary {
  onTime: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
}

export interface EmployeeToday {
  employeeId: string;
  name: string;
  branch: string;
  status: 'ON_TIME' | 'LATE' | 'ABSENT' | 'LEAVE' | 'LEAVE_APPROVED';
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  eventId: number | null;
  avatarUrl?: string | null;
}

export interface BranchMapItem {
  branchId: number;
  name: string;
  latitude: number;
  longitude: number;
  totalEmployees: number;
  address: string;
}

export interface LocationEvent {
  eventId: number;
  employeeName: string;
  checkInTime: string;
  expectedLocation: string;
  actualDistance: number;
  allowedRadius: number;
  timestamp: string;
}

export interface EventStatsPerson {
  userId: number;
  employeeId: string;
  name: string;
  branch: string;
  checkIn?: string;
  status?: string;
}

export interface EventStatsResponse {
  eventId: number;
  eventName: string;
  participantType: string;
  isOpenEvent: boolean;
  joined: EventStatsPerson[];
  notJoined: EventStatsPerson[];
  joinedCount: number;
  notJoinedCount: number;
}


// ── Service Methods ──

export const dashboardService = {
  /**
   * GET /api/dashboard/attendance-summary
   * สรุป attendance วันนี้ (Donut Chart)
   */
  async getAttendanceSummary(branchId?: number, date?: string): Promise<AttendanceSummary> {
    const params: Record<string, string | number> = {};
    if (branchId) params.branchId = branchId;
    if (date) params.date = date;
    const res = await api.get('/dashboard/attendance-summary', { params });
    return res.data.data;
  },

  /**
   * GET /api/dashboard/employees-today
   * รายชื่อพนักงานพร้อมสถานะวันนี้ (Table)
   */
  async getEmployeesToday(branchId?: number, date?: string): Promise<{ data: EmployeeToday[]; total: number }> {
    const params: Record<string, string | number> = {};
    if (branchId) params.branchId = branchId;
    if (date) params.date = date;
    const res = await api.get('/dashboard/employees-today', { params });
    return { data: res.data.data, total: res.data.total };
  },

  /**
   * GET /api/dashboard/branches-map
   * ข้อมูลสาขาพร้อม lat/lng (Map Pins)
   */
  async getBranchesMap(): Promise<{ data: BranchMapItem[]; total: number }> {
    const res = await api.get('/dashboard/branches-map');
    return { data: res.data.data, total: res.data.total };
  },

  /**
   * GET /api/dashboard/location-events
   * พนักงานที่ check-in นอกพื้นที่ (Alert List)
   */
  async getLocationEvents(branchId?: number, date?: string): Promise<{ data: LocationEvent[]; total: number }> {
    const params: Record<string, string | number> = {};
    if (branchId) params.branchId = branchId;
    if (date) params.date = date;
    const res = await api.get('/dashboard/location-events', { params });
    return { data: res.data.data, total: res.data.total };
  },

  /**
   * GET /api/dashboard/event-stats/:eventId
   * สถิติการเข้าร่วม / ยังไม่เข้าร่วมของกิจกรรม
   */
  async getEventStats(eventId: number): Promise<EventStatsResponse> {
    const res = await api.get(`/dashboard/event-stats/${eventId}`);
    return res.data.data;
  },
};

export default dashboardService;
