import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * 📋 Attendance Controller - จัดการ API การเข้า-ออกงาน
 */

/**
 * Check-in
 * POST /api/attendance/check-in
 */
export const checkIn = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const {
      shiftId,
      locationId,
      photo,
      latitude,
      longitude,
      address,
    } = req.body;

    const attendance = await attendanceService.checkIn({
      userId,
      shiftId: shiftId ? parseInt(shiftId) : undefined,
      locationId: locationId ? parseInt(locationId) : undefined,
      photo,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      address,
    });

    sendSuccess(res, attendance, 'เข้างานเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการเข้างาน');
  }
};

/**
 * Check-out
 * POST /api/attendance/check-out
 */
export const checkOut = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const {
      shiftId,
      photo,
      latitude,
      longitude,
      address,
    } = req.body;

    const attendance = await attendanceService.checkOut({
      userId,
      shiftId: shiftId ? parseInt(shiftId) : undefined,
      photo,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      address,
    });

    sendSuccess(res, attendance, 'ออกงานเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการออกงาน');
  }
};

/**
 * ดึงประวัติการเข้างาน (ของตัวเอง)
 * GET /api/attendance/history
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const { startDate, endDate, status } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      status: status as any,
    };

    const attendances = await attendanceService.getAttendanceHistory(userId, filters);

    sendSuccess(res, attendances);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงประวัติการเข้างาน');
  }
};

/**
 * ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * GET /api/attendance
 */
export const getAllAttendances = async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, status } = req.query;

    const filters = {
      userId: userId ? parseInt(userId as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      status: status as any,
    };

    const attendances = await attendanceService.getAllAttendances(filters);

    sendSuccess(res, attendances);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน');
  }
};

/**
 * อัปเดตการเข้างาน (Admin only)
 * PUT /api/attendance/:id
 */
export const updateAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(req.params.id);

    const {
      status,
      note,
      checkIn,
      checkOut,
    } = req.body;

    const data = {
      status,
      note,
      checkIn: checkIn ? new Date(checkIn) : undefined,
      checkOut: checkOut ? new Date(checkOut) : undefined,
    };

    const updatedAttendance = await attendanceService.updateAttendance(attendanceId, data);

    sendSuccess(res, updatedAttendance, 'อัปเดตการเข้างานเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตการเข้างาน');
  }
};

/**
 * ลบการเข้างาน (Admin only)
 * DELETE /api/attendance/:id
 */
export const deleteAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(req.params.id);

    await attendanceService.deleteAttendance(attendanceId);

    sendSuccess(res, null, 'ลบการเข้างานเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบการเข้างาน');
  }
};

export default {
  checkIn,
  checkOut,
  getHistory,
  getAllAttendances,
  updateAttendance,
  deleteAttendance,
};
