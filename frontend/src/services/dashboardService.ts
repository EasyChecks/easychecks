/**
 * dashboardService.ts
 * ─────────────────────────────────────────
 * ทำไมต้องแยก service layer ออกจาก component?
 * - เพื่อให้ component ไม่ต้องรู้ว่า API URL คืออะไร หรือต้อง set header อะไร
 * - เปลี่ยน backend URL หรือ response shape ที่เดียว ไม่ต้องแก้ทุก component
 * - ใช้ร่วมกันได้ทั้ง Admin Dashboard และ SuperAdmin Dashboard
 *
 * Base URL: /api/dashboard
 * สิทธิ์: ADMIN / SUPERADMIN เท่านั้น (middleware ฝั่ง backend ตรวจ role ให้)
 */

import api from './api';

// ── Types (ตรงกับ backend response) ──
// ทำไมต้องประกาศ type ที่ frontend ด้วย?
// - TypeScript บังคับให้ component รู้ว่าจะได้ data shape อะไร
// - ถ้า backend เปลี่ยน field → TS จะ error ตั้งแต่ compile time ไม่ต้องรอ runtime

export interface AttendanceSummary {
  onTime: number;
  late: number;
  absent: number;
  leave: number;   // จำนวนคนลา (แยกจาก absent เพราะลาอนุมัติ ≠ ขาดงาน)
  total: number;   // รวม attendance + leave (ไม่ซ้ำกัน)
}

// ทำไม status มีหลายค่า?
// - ต้องแยก ON_TIME/LATE/ABSENT เพื่อแสดงสีต่างกันใน table
// - LEAVE vs LEAVE_APPROVED ต่างกัน: LEAVE = ลาแต่ยังไม่อนุมัติ
// - eventId ใช้แยกว่าเป็น attendance ของกะงาน (null) หรือกิจกรรม (มีค่า)
export interface EmployeeToday {
  employeeId: string;
  name: string;
  branch: string;
  status: 'ON_TIME' | 'LATE' | 'ABSENT' | 'LEAVE' | 'LEAVE_APPROVED';
  checkIn: string | null;    // format HH:mm (null = ยังไม่ check-in)
  checkOut: string | null;   // null = ยังไม่ check-out
  lateMinutes: number;
  eventId: number | null;    // null = กะงาน, มีค่า = กิจกรรม
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
   * ทำไมต้อง endpoint แยก?
   * - Donut chart ต้องการแค่ตัวเลข 4-5 ค่า ไม่ต้องข้อมูลรายคน
   * - query เบาแค่ aggregate → ตอบเร็วกว่าดึงทั้ง list
   *
   * SQL เบื้องหลัง:
   * SELECT status, COUNT(*) FROM attendance
   * WHERE branch_id = ? AND DATE(check_in) = ?
   * GROUP BY status;
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
   * ทำไมแยกจาก attendance-summary?
   * - summary = ตัวเลขรวม (Donut chart), employees-today = รายชื่อ (Table)
   * - Table ต้องการข้อมูลชื่อ/เวลา/สถานะรายคน → payload ใหญ่กว่า
   *
   * SQL เบื้องหลัง:
   * SELECT u.employee_id, u.first_name, u.last_name, a.status, a.check_in, a.check_out
   * FROM users u LEFT JOIN attendance a ON u.user_id = a.user_id AND DATE(a.check_in) = ?
   * WHERE u.branch_id = ? AND u.status = 'ACTIVE';
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
   * ทำไมต้องมี endpoint แยกจาก branch list ทั่วไป?
   * - endpoint นี้ส่งข้อมูลเฉพาะที่ map ต้องการ (lat/lng, จำนวนพนักงาน)
   * - ADMIN เห็นแค่สาขาตัวเอง, SUPERADMIN เห็นหมด
   *
   * SQL เบื้องหลัง:
   * SELECT b.branch_id, b.name, b.address, COUNT(u.user_id) as total_employees
   * FROM branches b LEFT JOIN users u ON b.branch_id = u.branch_id
   * GROUP BY b.branch_id;
   */
  async getBranchesMap(): Promise<{ data: BranchMapItem[]; total: number }> {
    const res = await api.get('/dashboard/branches-map');
    return { data: res.data.data, total: res.data.total };
  },

  /**
   * GET /api/dashboard/location-events
   * ทำไมต้องมี endpoint นี้?
   * - Security monitoring: ตรวจจับพนักงานที่ check-in จากตำแหน่งผิดปกติ
   * - กรอง attendance ที่ checkInDistance > location.radius
   * - Admin ต้องรู้ทันทีว่าใครเข้างานนอกพื้นที่ (อาจ fake GPS)
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
   * ทำไมต้องดึงสถิติ per-event แยก?
   * - Dashboard มี dropdown เลือกกิจกรรม แล้วแสดงว่าใครเข้าร่วม/ยังไม่เข้าร่วม
   * - ดึงทั้ง list รวมมาจะ payload ใหญ่มาก → แยก endpoint per-event
   *
   * SQL เบื้องหลัง:
   * SELECT u.* FROM attendance a JOIN users u ON a.user_id = u.user_id
   * WHERE a.event_id = ?;  -- คนที่เข้าร่วมแล้ว
   * -- + เปรียบเทียบกับ event_participants → หาคนที่ยังไม่เข้าร่วม
   */
  async getEventStats(eventId: number): Promise<EventStatsResponse> {
    const res = await api.get(`/dashboard/event-stats/${eventId}`);
    return res.data.data;
  },
};

export default dashboardService;
