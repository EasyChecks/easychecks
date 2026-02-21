/**
 * attendance.ts (src/services/attendance.ts)
 * ─────────────────────────────────────────────
 * HTTP client สำหรับ Attendance API
 *
 * ทำหน้าที่: ส่ง request ไปยัง backend /api/attendance/*
 * ถูกเรียกใช้โดย: src/app/user/attendance/page.tsx
 *
 * ทุก method ที่ต้องการ userId ต้องได้ค่านั้นมาจาก useAuth() ใน component ก่อน
 * เพราะ backend อ่าน userId จาก JWT token แต่ history/today endpoint ต้องการ userId ใน URL ด้วย
 */

import api from './api';
import {
  Attendance,
  CheckInRequest,
  CheckOutRequest,
  AttendanceHistoryParams,
  AttendanceListParams,
  UpdateAttendanceRequest,
} from '@/types/attendance';

export const attendanceService = {
  /**
   * checkIn() — บันทึกเวลาเข้างาน
   * POST /api/attendance/check-in
   *
   * ส่ง: shiftId, photo (Base64), latitude, longitude, address (optional)
   * backend อ่าน userId จาก JWT token เองอัตโนมัติ (ไม่ต้องส่ง userId)
   * backend ตรวจสอบ GPS radius และกำหนด status: ON_TIME / LATE
   */
  async checkIn(data: CheckInRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-in', data);
    return response.data.data;
  },

  /**
   * checkOut() — บันทึกเวลาออกงาน
   * POST /api/attendance/check-out
   *
   * ส่ง: shiftId, photo (Base64), latitude, longitude
   * backend จะหา record check-in ที่ยังไม่มี checkOut อยู่ แล้ว update
   */
  async checkOut(data: CheckOutRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-out', data);
    return response.data.data;
  },

  /**
   * getMyHistory() — ดึงประวัติการเข้างานของ user คนนั้น
   * GET /api/attendance/history/:userId
   *
   * @param userId  - ได้จาก useAuth().user.id (แปลงเป็น number แล้ว)
   * @param params  - filter: startDate, endDate, status (optional)
   *
   * ใช้ในหน้า attendance เพื่อคำนวณสถิติรายเดือน
   */
  async getMyHistory(userId: number, params?: AttendanceHistoryParams): Promise<Attendance[]> {
    const response = await api.get(`/attendance/history/${userId}`, { params });
    return response.data.data;
  },

  /**
   * getAll() — ดึงประวัติการเข้างานทั้งหมด (Admin เท่านั้น)
   * GET /api/attendance
   *
   * @param params - filter เพิ่มเติม: userId, startDate, endDate, status
   */
  async getAll(params?: AttendanceListParams): Promise<Attendance[]> {
    const response = await api.get('/attendance', { params });
    return response.data.data;
  },

  /** ดึง attendance record เดี่ยวโดย id — GET /api/attendance/:id */
  async getById(id: number): Promise<Attendance> {
    const response = await api.get(`/attendance/${id}`);
    return response.data.data;
  },

  /** แก้ไข attendance record (Admin เท่านั้น) — PUT /api/attendance/:id */
  async update(id: number, data: UpdateAttendanceRequest): Promise<Attendance> {
    const response = await api.put(`/attendance/${id}`, data);
    return response.data.data;
  },

  /** ลบ attendance record (Admin เท่านั้น, Soft Delete) — DELETE /api/attendance/:id */
  async delete(id: number): Promise<void> {
    await api.delete(`/attendance/${id}`);
  },

  /**
   * getTodayStatus() — ดึงสถานะการเข้างานวันนี้ของ user
   * GET /api/attendance/today/:userId
   *
   * @param userId - ได้จาก useAuth().user.id
   * @returns { hasCheckedIn, hasCheckedOut, attendance? }
   *
   * ใช้กำหนดว่าปุ่ม "เข้างาน" หรือ "ออกงาน" ควร active ไหม
   * ถ้ายังไม่ check-in → ปุ่ม "เข้างาน" active, ปุ่ม "ออกงาน" disabled
   * ถ้า check-in แล้วแต่ยังไม่ check-out → ปุ่ม "ออกงาน" active
   * ถ้า check-out แล้ว → ทั้งคู่ disabled
   */
  async getTodayStatus(userId: number): Promise<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }> {
    try {
      const response = await api.get(`/attendance/today/${userId}`);
      const todayAttendance = response.data.data; // null ถ้ายังไม่ check-in วันนี้

      return {
        hasCheckedIn: !!todayAttendance,
        hasCheckedOut: !!todayAttendance?.checkOut,
        attendance: todayAttendance ?? undefined,
      };
    } catch (error) {
      console.error('Error fetching today status:', error);
      // ถ้า API ล้มเหลว → ถือว่ายังไม่ได้ check-in (แสดง UI ที่ safe ที่สุด)
      return {
        hasCheckedIn: false,
        hasCheckedOut: false,
      };
    }
  },
};

export default attendanceService;
