import type { Request, Response } from 'express';
import type { AttendanceStatus } from '@prisma/client';
import * as attendanceService from '../services/attendance.service.js';
import { broadcastAttendanceUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';

/** req.query の値は string | string[] になりうるので string に正規化する */
function qs(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0] as string;
  return undefined;
}

/**
 * 📋 Attendance Controller — API การเข้า-ออกงาน
 *
 * ทำไมถึง thin controller?
 * - validation เบื้องต้น (params/query/body)
 * - ดึง userId จาก req.user ที่ authenticate middleware ตั้งไว้
 * - ส่งต่อ business logic ทั้งหมดให้ attendance.service.ts
 * - broadcast WebSocket หลัง write สำเร็จ
 *
 * ============================================================
 * API ENDPOINT REFERENCE (การเข้า-ออกงาน)
 * ============================================================
 *
 * POST /api/attendance/check-in
 *   → พนักงานเข้างาน; บันทึก GPS + สถานะ ON_TIME/LATE/ABSENT
 *   → ต้อง login ก่อน (Bearer token)
 *   → Body: { shiftId?, locationId?, photo?, latitude?, longitude?, address? }
 *
 * POST /api/attendance/check-out
 *   → พนักงานออกงาน; update checkOut timestamp บน record เดิม
 *   → Body: { attendanceId?, shiftId?, photo?, latitude?, longitude?, address? }
 *
 * GET /api/attendance/history/:userId
 *   → ดูประวัติของตัวเอง (User) หรือพนักงานคนอื่น (Admin)
 *   → Query: startDate?, endDate?, status?
 *
 * GET /api/attendance
 *   → ดูประวัติทั้งหมด (Admin/SuperAdmin เท่านั้น)
 *   → Query: userId?, startDate?, endDate?, status?
 *
 * GET /api/attendance/today/:userId
 *   → สถานะวันนี้ของพนักงาน (ใช้แสดงบน Dashboard)
 *
 * PUT /api/attendance/:id
 *   → Admin แก้ไขประวัติที่ผิดพลาด (GPS ผิด, ลืม check-out)
 *   → Body: { status?, note?, checkIn?, checkOut? }
 *
 * DELETE /api/attendance/:id  (Soft Delete)
 *   → Admin ลบ record ที่ไม่ถูกต้อง; ใส่เหตุผลเสมอ
 *   → Body: { deleteReason: string }
 */

/**
 * ✅ Check-in (เข้างาน)
 * POST /api/attendance/check-in
 */
export const checkIn = async (req: Request, res: Response) => {
  try {
    // [1] อ่าน userId จาก token ที่ authenticate middleware ถอดรหัสไว้แล้ว
    //     ทำไมไม่อ่านจาก req.body? เพราะ client ปลอม userId ของคนอื่นได้
    const userId = req.user?.userId;

    // [2] ถ้าไม่มี userId แสดงว่า request ผ่านมาโดยไม่มี token → reject ทันที
    if (userId === undefined) return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);

    // [3] Destructure body — ทุก field เป็น optional เพราะ check-in แบบ walk-in ก็ได้
    //     shiftId?     → ถ้าไม่ส่ง บันทึกแบบไม่มีกะ
    //     locationId?  → ถ้าไม่ส่ง ไม่ตรวจสอบ GPS radius
    //     photo?       → Base64 selfie พิสูจน์ตัวตน
    //     latitude/longitude? → พิกัด GPS จาก browser / app
    //     address?     → ที่อยู่ที่ reverse-geocode มาแล้วจาก frontend
    const { shiftId, locationId, photo, latitude, longitude, address } = req.body as {
      shiftId?: number;
      locationId?: number;
      photo?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
    };

    // [4] ส่งข้อมูลทั้งหมดให้ attendanceService.checkIn() จัดการ
    //     แปลง string → number ตรงนี้เพราะ body JSON อาจส่งมาเป็น string
    const attendance = await attendanceService.checkIn({
      userId,                                                             // from token
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,      // optional
      locationId: locationId !== undefined ? Number(locationId) : undefined, // optional
      photo,                                                              // Base64
      latitude: latitude !== undefined ? Number(latitude) : undefined,   // GPS
      longitude: longitude !== undefined ? Number(longitude) : undefined, // GPS
      address,                                                            // reverse geocode
    });

    // [5] แจ้งทุก client ที่เปิด Dashboard อยู่ผ่าน WebSocket ว่ามีคนเข้างานใหม่
    //     ทำไมต้อง broadcast? ให้ Admin เห็น real-time โดยไม่ต้อง refresh
    broadcastAttendanceUpdate('CHECK_IN', attendance);

    // [6] Response 201 Created พร้อม attendance record ที่เพิ่งสร้าง
    sendSuccess(res, attendance, 'เข้างานเรียบร้อยแล้ว', 201);
  } catch (error: unknown) {
    // [7] Service โยน Error พร้อม message ภาษาไทย (double check-in, นอก GPS ฯลฯ)
    //     catch ตรงนี้แปลงให้เป็น HTTP 500 พร้อม message
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเข้างาน');
  }
};

/**
 * 🚪 Check-out (ออกงาน)
 * POST /api/attendance/check-out
 */
export const checkOut = async (req: Request, res: Response) => {
  try {
    // [1] ดึง userId จาก token ที่ middleware ถอดรหัสไว้แล้ว (เหมือน checkIn)
    const userId = req.user?.userId;
    if (userId === undefined) return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);

    // [2] Destructure body
    //     attendanceId? → ระบุตรงว่าจะ check-out record ไหน (มีหลายกะพร้อมกัน)
    //                     ถ้าไม่ระบุ service จะหา record ล่าสุดที่ยังไม่ check-out อัตโนมัติ
    //     shiftId?      → ใช้กรองเพิ่มเมื่อไม่มี attendanceId
    //     photo?        → selfie ตอนออกงาน
    //     latitude/longitude? → GPS ตอนออก (ตรวจ radius อีกรอบ)
    //     address?      → reverse geocode ตอนออก
    const { attendanceId, shiftId, photo, latitude, longitude, address } = req.body as {
      attendanceId?: number;
      shiftId?: number;
      photo?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
    };

    // [3] ส่งให้ service จัดการ: หา record → ตรวจ GPS → UPDATE checkOut
    const attendance = await attendanceService.checkOut({
      userId,
      attendanceId: attendanceId !== undefined ? Number(attendanceId) : undefined,
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,
      photo,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      address,
    });

    // [4] Broadcast ให้ Dashboard อัปเดต real-time
    broadcastAttendanceUpdate('CHECK_OUT', attendance);

    // [5] Response 200 OK พร้อม record ที่อัปเดตแล้ว
    sendSuccess(res, attendance, 'ออกงานเรียบร้อยแล้ว');
  } catch (error: unknown) {
    // [6] service โยน Error ถ้า: ไม่มี check-in ที่ค้างอยู่, GPS นอก radius
    console.error('CheckOut error:', error);
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการออกงาน';
    const status = msg.includes('ไม่พบ') ? 400 : 500;
    sendError(res, msg, status);
  }
};

/**
 * 📋 ดึงประวัติการเข้างานของ user คนเดียว
 * GET /api/attendance/history/:userId
 *
 * ทำไม userId มาจาก params ไม่ใช่ req.user?
 * Admin ต้องการดูประวัติของพนักงานคนอื่น → params ยืดหยุ่นกว่า
 * (route-level authorize ดูแลสิทธิ์แล้ว)
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(qs(req.params['userId']) ?? '');
    if (isNaN(userId)) return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);

    const startDate = qs(req.query['startDate']);
    const endDate = qs(req.query['endDate']);
    const status = qs(req.query['status']) as AttendanceStatus | undefined;

    type HistoryFilters = Parameters<typeof attendanceService.getAttendanceHistory>[1];
    const filters: HistoryFilters = {};
    if (startDate !== undefined) filters.startDate = new Date(startDate);
    if (endDate !== undefined) filters.endDate = new Date(endDate);
    if (status !== undefined) filters.status = status;

    const attendances = await attendanceService.getAttendanceHistory(userId, filters);
    sendSuccess(res, attendances);
  } catch (error: unknown) {
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงประวัติการเข้างาน');
  }
};

/**
 * 📋 ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * GET /api/attendance
 */
export const getAllAttendances = async (req: Request, res: Response) => {
  try {
    const userId = qs(req.query['userId']);
    const startDate = qs(req.query['startDate']);
    const endDate = qs(req.query['endDate']);
    const status = qs(req.query['status']) as AttendanceStatus | undefined;

    type AllFilters = Parameters<typeof attendanceService.getAllAttendances>[0];
    const filters: AllFilters = {};
    if (userId !== undefined) filters.userId = parseInt(userId);
    if (startDate !== undefined) filters.startDate = new Date(startDate);
    if (endDate !== undefined) filters.endDate = new Date(endDate);
    if (status !== undefined) filters.status = status;

    const attendances = await attendanceService.getAllAttendances(filters);
    sendSuccess(res, attendances);
  } catch (error: unknown) {
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน');
  }
};

/**
 * 📋 ดึงข้อมูลการเข้างานวันนี้ของ user
 * GET /api/attendance/today/:userId
 */
export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(qs(req.params['userId']) ?? '');
    if (isNaN(userId)) return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);

    const attendance = await attendanceService.getTodayAttendance(userId);
    sendSuccess(res, attendance);
  } catch (error: unknown) {
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างานวันนี้');
  }
};

/**
 * 🔄 อัปเดตการเข้างาน (Admin only)
 * PUT /api/attendance/:id
 *
 * Body: { status?, note?, checkIn?, checkOut? }
 */
export const updateAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(attendanceId)) return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);

    // updatedByUserId ดึงจาก req.user แทนการรับจาก body เพื่อความปลอดภัย
    const updatedByUserId = req.user?.userId;

    const { status, note, checkIn, checkOut } = req.body as {
      status?: string;
      note?: string;
      checkIn?: string;
      checkOut?: string;
    };

    type UpdateData = Parameters<typeof attendanceService.updateAttendance>[1];
    const data: UpdateData = {};
    if (status !== undefined) data.status = status as UpdateData['status'];
    if (note !== undefined) data.note = note;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);

    const updatedAtt = await attendanceService.updateAttendance(attendanceId, data, updatedByUserId);

    broadcastAttendanceUpdate('UPDATE', updatedAtt);
    sendSuccess(res, updatedAtt, 'อัปเดตการเข้างานเรียบร้อยแล้ว');
  } catch (error: unknown) {
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตการเข้างาน');
  }
};

/**
 * 🗑️ ลบการเข้างาน (Admin only — Soft Delete)
 * DELETE /api/attendance/:id
 *
 * Body: { deleteReason: string }
 */
export const deleteAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(attendanceId)) return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);

    const deletedByUserId = req.user?.userId;
    const { deleteReason } = req.body as { deleteReason?: string };

    if (!deleteReason || deleteReason.trim() === '') {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    await attendanceService.deleteAttendance(attendanceId, deletedByUserId, deleteReason);

    broadcastAttendanceUpdate('DELETE', { attendanceId });
    sendSuccess(res, null, 'ลบการเข้างานเรียบร้อยแล้ว (Soft Delete)');
  } catch (error: unknown) {
    sendError(res, error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบการเข้างาน');
  }
};

export default {
  checkIn,
  checkOut,
  getHistory,
  getAllAttendances,
  getTodayAttendance,
  updateAttendance,
  deleteAttendance,
};
