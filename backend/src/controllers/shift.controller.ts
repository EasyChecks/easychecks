import { Request, Response } from 'express';
import * as shiftService from '../services/shift.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * 📋 Shift Controller - จัดการ API เกี่ยวกับตารางงาน/กะ
 */

/**
 * สร้างกะใหม่ (Admin)
 * POST /api/shifts
 */
export const createShift = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const shift = await shiftService.createShift({
      ...req.body,
      userId: req.body.userId || userId, // Admin สามารถสร้างให้ user อื่นได้
    });

    sendSuccess(res, shift, 'สร้างกะเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างกะ');
  }
};

/**
 * ดึงกะทั้งหมดของตัวเอง (User) หรือทั้งหมด (Admin)
 * GET /api/shifts
 */
export const getShifts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    let shifts;

    if (role === 'ADMIN' || role === 'SUPERADMIN') {
      // Admin ดูได้ทุกกะ
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        shiftType: req.query.shiftType as any,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      };
      shifts = await shiftService.getAllShifts(filters);
    } else {
      // User ดูได้เฉพาะกะของตัวเอง
      shifts = await shiftService.getShiftsByUserId(userId);
    }

    sendSuccess(res, shifts);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ');
  }
};

/**
 * ดึงกะที่ใช้งานได้ในวันนี้
 * GET /api/shifts/today
 */
export const getActiveShiftsToday = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const shifts = await shiftService.getActiveShiftsForToday(userId);

    sendSuccess(res, shifts);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะวันนี้');
  }
};

/**
 * ดึงกะเฉพาะ ID
 * GET /api/shifts/:id
 */
export const getShiftById = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id);

    const shift = await shiftService.getShiftById(shiftId);

    sendSuccess(res, shift);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ');
  }
};

/**
 * อัปเดตกะ
 * PUT /api/shifts/:id
 */
export const updateShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id);
    const userId = req.user?.userId!;
    const role = req.user?.role!;

    const updatedShift = await shiftService.updateShift(shiftId, userId, role, req.body);

    sendSuccess(res, updatedShift, 'อัปเดตกะเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตกะ');
  }
};

/**
 * ลบกะ (Admin only)
 * DELETE /api/shifts/:id
 */
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id);

    await shiftService.deleteShift(shiftId);

    sendSuccess(res, null, 'ลบกะเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบกะ');
  }
};

export default {
  createShift,
  getShifts,
  getActiveShiftsToday,
  getShiftById,
  updateShift,
  deleteShift,
};
