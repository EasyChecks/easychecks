import type { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service.js';
import { broadcastAttendanceUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * 📋 Attendance Controller - จัดการ API การเข้า-ออกงาน
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่มี Auth Middleware
 * - รับ userId จาก body แทน req.user
 * - รอเพื่อนทำ Auth เสร็จค่อยเปลี่ยน
 */

/**
 * ✅ Check-in (เข้างาน)
 * POST /api/attendance/check-in
 * 
 * Body: {
 *   userId: number,        // (จำเป็น) รหัสผู้ใช้
 *   shiftId?: number,      // (optional) รหัสกะงาน
 *   locationId?: number,   // (optional) รหัสสถานที่
 *   photo?: string,        // (optional) รูปภาพ Base64
 *   latitude?: number,     // (optional) ละติจูด GPS
 *   longitude?: number,    // (optional) ลองจิจูด GPS  
 *   address?: string       // (optional) ที่อยู่
 * }
 */
export const checkIn = async (req: Request, res: Response) => {
  try {
    // ดึง userId จาก body (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user?.userId
    const { userId, shiftId, locationId, photo, latitude, longitude, address } = req.body;

    // ตรวจสอบว่ามี userId มาไหม
    if (!userId) {
      return sendError(res, 'กรุณาระบุ userId', 400);
    }

    // เตรียมข้อมูลสำหรับ check-in (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    const checkInData: Parameters<typeof attendanceService.checkIn>[0] = {
      userId: parseInt(userId),
    };
    if (shiftId) checkInData.shiftId = parseInt(shiftId);
    if (locationId) checkInData.locationId = parseInt(locationId);
    if (photo) checkInData.photo = photo;
    if (latitude) checkInData.latitude = parseFloat(latitude);
    if (longitude) checkInData.longitude = parseFloat(longitude);
    if (address) checkInData.address = address;

    // เรียก service เพื่อ check-in
    const attendance = await attendanceService.checkIn(checkInData);

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Create สำเร็จ
    broadcastAttendanceUpdate('CHECK_IN', attendance);

    sendSuccess(res, attendance, 'เข้างานเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการเข้างาน');
  }
};

/**
 * 🚪 Check-out (ออกงาน)
 * POST /api/attendance/check-out
 * 
 * Body: {
 *   userId: number,        // (จำเป็น) รหัสผู้ใช้
 *   attendanceId?: number, // (optional) รหัส attendance ที่จะออก
 *   shiftId?: number,      // (optional) รหัสกะงาน
 *   photo?: string,        // (optional) รูปภาพ Base64
 *   latitude?: number,     // (optional) ละติจูด GPS
 *   longitude?: number,    // (optional) ลองจิจูด GPS
 *   address?: string       // (optional) ที่อยู่
 * }
 */
export const checkOut = async (req: Request, res: Response) => {
  try {
    // ดึง userId จาก body (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user?.userId
    const { userId, attendanceId, shiftId, photo, latitude, longitude, address } = req.body;

    // ตรวจสอบว่ามี userId มาไหม
    if (!userId) {
      return sendError(res, 'กรุณาระบุ userId', 400);
    }

    // เตรียมข้อมูลสำหรับ check-out (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    const checkOutData: Parameters<typeof attendanceService.checkOut>[0] = {
      userId: parseInt(userId),
    };
    if (attendanceId) checkOutData.attendanceId = parseInt(attendanceId);
    if (shiftId) checkOutData.shiftId = parseInt(shiftId);
    if (photo) checkOutData.photo = photo;
    if (latitude) checkOutData.latitude = parseFloat(latitude);
    if (longitude) checkOutData.longitude = parseFloat(longitude);
    if (address) checkOutData.address = address;

    // เรียก service เพื่อ check-out
    const attendance = await attendanceService.checkOut(checkOutData);

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Update สำเร็จ
    broadcastAttendanceUpdate('CHECK_OUT', attendance);

    sendSuccess(res, attendance, 'ออกงานเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการออกงาน');
  }
};

/**
 * 📋 ดึงประวัติการเข้างาน (ของ user คนนั้น)
 * GET /api/attendance/history/:userId
 * 
 * Query: startDate?, endDate?, status?
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    // ดึง userId จาก params
    const userId = parseInt(req.params.userId as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const { startDate, endDate, status } = req.query;

    // เตรียม filter (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    type HistoryFilters = Parameters<typeof attendanceService.getAttendanceHistory>[1];
    const filters: HistoryFilters = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (status) filters.status = status as any;

    // เรียก service
    const attendances = await attendanceService.getAttendanceHistory(userId, filters);

    sendSuccess(res, attendances);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงประวัติการเข้างาน');
  }
};

/**
 * 📋 ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * GET /api/attendance
 * 
 * Query: userId?, startDate?, endDate?, status?
 */
export const getAllAttendances = async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, status } = req.query;

    // เตรียม filter (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    type AllFilters = Parameters<typeof attendanceService.getAllAttendances>[0];
    const filters: AllFilters = {};
    if (userId) filters.userId = parseInt(userId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (status) filters.status = status as any;

    // เรียก service
    const attendances = await attendanceService.getAllAttendances(filters);

    sendSuccess(res, attendances);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน');
  }
};

/**
 * 📋 ดึงข้อมูลการเข้างานวันนี้ของ user
 * GET /api/attendance/today/:userId
 */
export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    // เรียก service
    const attendance = await attendanceService.getTodayAttendance(userId);

    sendSuccess(res, attendance);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างานวันนี้');
  }
};

/**
 * 🔄 อัปเดตการเข้างาน (Admin only)
 * PUT /api/attendance/:id
 * 
 * Body: {
 *   updatedByUserId: number, // (จำเป็น) ผู้แก้ไข
 *   status?, note?, checkIn?, checkOut?
 * }
 */
export const updateAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(req.params.id as string);

    if (!attendanceId || isNaN(attendanceId)) {
      return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);
    }

    const { updatedByUserId, status, note, checkIn, checkOut } = req.body;

    // ตรวจสอบว่ามี updatedByUserId มาไหม
    if (!updatedByUserId) {
      return sendError(res, 'กรุณาระบุ updatedByUserId (ผู้แก้ไข)', 400);
    }

    // เตรียมข้อมูลที่จะอัพเดต (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    type UpdateData = Parameters<typeof attendanceService.updateAttendance>[1];
    const data: UpdateData = {};
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note;
    if (checkIn) data.checkIn = new Date(checkIn);
    if (checkOut) data.checkOut = new Date(checkOut);

    // เรียก service
    const updatedAttendance = await attendanceService.updateAttendance(
      attendanceId, 
      data, 
      parseInt(updatedByUserId)
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Update สำเร็จ
    broadcastAttendanceUpdate('UPDATE', updatedAttendance);

    sendSuccess(res, updatedAttendance, 'อัปเดตการเข้างานเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตการเข้างาน');
  }
};

/**
 * 🗑️ ลบการเข้างาน (Admin only - Soft Delete)
 * DELETE /api/attendance/:id
 * 
 * Body: { 
 *   deletedByUserId: number,  // (จำเป็น) ผู้ลบ
 *   deleteReason: string      // (จำเป็น) เหตุผลในการลบ
 * }
 */
export const deleteAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(req.params.id as string);

    if (!attendanceId || isNaN(attendanceId)) {
      return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);
    }

    const { deletedByUserId, deleteReason } = req.body;

    // ตรวจสอบว่ามี deletedByUserId มาไหม
    if (!deletedByUserId) {
      return sendError(res, 'กรุณาระบุ deletedByUserId (ผู้ลบ)', 400);
    }

    // ตรวจสอบว่ามี deleteReason มาไหม
    if (!deleteReason || deleteReason.trim() === '') {
      return sendError(res, 'กรุณาระบุ deleteReason (เหตุผลในการลบ)', 400);
    }

    // เรียก service (soft delete)
    await attendanceService.deleteAttendance(
      attendanceId, 
      parseInt(deletedByUserId),
      deleteReason
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Delete สำเร็จ
    broadcastAttendanceUpdate('DELETE', { attendanceId });

    sendSuccess(res, null, 'ลบการเข้างานเรียบร้อยแล้ว (Soft Delete)');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบการเข้างาน');
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
