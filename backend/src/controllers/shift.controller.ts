import type { Request, Response } from 'express';
import * as shiftService from '../services/shift.service.js';
import { broadcastShiftUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * 📋 Shift Controller - จัดการ API เกี่ยวกับตารางงาน/กะ
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่มี Auth Middleware
 * - รับ userId, role, branchId จาก body แทน req.user
 * - รอเพื่อนทำ Auth เสร็จค่อยเปลี่ยน
 * 
 * สิทธิ์การเข้าถึง:
 * - SuperAdmin: ดู/สร้าง/แก้/ลบ ได้ทุกสาขา
 * - Admin: ดู/สร้าง/แก้/ลบ ได้เฉพาะสาขาตัวเอง
 * - User: ดูได้เฉพาะกะของตัวเอง
 */

/**
 * ➕ สร้างกะใหม่ (Admin/SuperAdmin only)
 * POST /api/shifts
 * 
 * Body: {
 *   createdByUserId: number,   // (จำเป็น) ผู้สร้าง
 *   creatorRole: string,       // (จำเป็น) ADMIN หรือ SUPERADMIN
 *   creatorBranchId?: number,  // (จำเป็นถ้าเป็น ADMIN) สาขาของผู้สร้าง
 *   name: string,              // (จำเป็น) ชื่อกะ
 *   shiftType: string,         // (จำเป็น) REGULAR, SPECIFIC_DAY, CUSTOM
 *   startTime: string,         // (จำเป็น) เวลาเริ่ม HH:MM
 *   endTime: string,           // (จำเป็น) เวลาสิ้นสุด HH:MM
 *   userId: number,            // (จำเป็น) พนักงานที่รับกะนี้
 *   locationId?: number,       // (optional) รหัสสถานที่
 *   gracePeriodMinutes?: number,
 *   lateThresholdMinutes?: number,
 *   specificDays?: string[],
 *   customDate?: string
 * }
 */
export const createShift = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูลจาก body (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user
    const { 
      createdByUserId, 
      creatorRole, 
      creatorBranchId,
      userId, // พนักงานที่รับกะนี้
      ...shiftData 
    } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!createdByUserId) {
      return sendError(res, 'กรุณาระบุ createdByUserId (ผู้สร้าง)', 400);
    }

    if (!creatorRole || !['ADMIN', 'SUPERADMIN'].includes(creatorRole)) {
      return sendError(res, 'กรุณาระบุ creatorRole ที่ถูกต้อง (ADMIN หรือ SUPERADMIN)', 400);
    }

    if (!userId) {
      return sendError(res, 'กรุณาระบุ userId (พนักงานที่รับกะ)', 400);
    }

    // เรียก service
    const shift = await shiftService.createShift({
      ...shiftData,
      userId: parseInt(userId),
      createdByUserId: parseInt(createdByUserId),
      creatorRole,
      creatorBranchId: creatorBranchId ? parseInt(creatorBranchId) : undefined,
    });

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Create สำเร็จ
    broadcastShiftUpdate('CREATE', shift);

    sendSuccess(res, shift, 'สร้างกะเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างกะ');
  }
};

/**
 * 📋 ดึงกะทั้งหมด (ตาม role และ branch)
 * GET /api/shifts
 * 
 * Query: {
 *   requesterId: number,     // (จำเป็น) ผู้ขอดูข้อมูล
 *   requesterRole: string,   // (จำเป็น) Role ของผู้ขอ
 *   requesterBranchId?: number,
 *   userId?: number,
 *   shiftType?: string,
 *   isActive?: boolean
 * }
 */
export const getShifts = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูลจาก query (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user
    const { 
      requesterId, 
      requesterRole, 
      requesterBranchId,
      userId, 
      shiftType, 
      isActive 
    } = req.query;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!requesterId) {
      return sendError(res, 'กรุณาระบุ requesterId (ผู้ขอดูข้อมูล)', 400);
    }

    if (!requesterRole) {
      return sendError(res, 'กรุณาระบุ requesterRole', 400);
    }

    // เตรียม filter (ส่งแค่ค่าที่มี ไม่ส่ง undefined)
    type ShiftFilters = Parameters<typeof shiftService.getShifts>[3];
    const filters: ShiftFilters = {};
    if (userId) filters.userId = parseInt(userId as string);
    if (shiftType) filters.shiftType = shiftType as any;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    // เรียก service (ส่ง role และ branchId ไปด้วยเพื่อกรองตามสิทธิ์)
    const shifts = await shiftService.getShifts(
      parseInt(requesterId as string),
      requesterRole as string,
      requesterBranchId ? parseInt(requesterBranchId as string) : undefined,
      filters
    );

    sendSuccess(res, shifts);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ');
  }
};

/**
 * 📋 ดึงกะที่ใช้งานได้ในวันนี้ของ user
 * GET /api/shifts/today/:userId
 */
export const getActiveShiftsToday = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    // เรียก service
    const shifts = await shiftService.getActiveShiftsForToday(userId);

    sendSuccess(res, shifts);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะวันนี้');
  }
};

/**
 * 📋 ดึงกะเฉพาะ ID
 * GET /api/shifts/:id
 */
export const getShiftById = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id as string);

    if (!shiftId || isNaN(shiftId)) {
      return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);
    }

    // เรียก service
    const shift = await shiftService.getShiftById(shiftId);

    sendSuccess(res, shift);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ');
  }
};

/**
 * 🔄 อัปเดตกะ
 * PUT /api/shifts/:id
 * 
 * Body: {
 *   updatedByUserId: number,   // (จำเป็น) ผู้แก้ไข
 *   updaterRole: string,       // (จำเป็น) Role ของผู้แก้ไข
 *   updaterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้แก้ไข
 *   name?, startTime?, endTime?, 
 *   gracePeriodMinutes?, lateThresholdMinutes?,
 *   specificDays?, customDate?, locationId?, isActive?
 * }
 */
export const updateShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id as string);

    if (!shiftId || isNaN(shiftId)) {
      return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);
    }

    // ดึงข้อมูลจาก body
    const { 
      updatedByUserId, 
      updaterRole, 
      updaterBranchId,
      ...updateData 
    } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!updatedByUserId) {
      return sendError(res, 'กรุณาระบุ updatedByUserId (ผู้แก้ไข)', 400);
    }

    if (!updaterRole) {
      return sendError(res, 'กรุณาระบุ updaterRole', 400);
    }

    // เรียก service
    const updatedShift = await shiftService.updateShift(
      shiftId, 
      parseInt(updatedByUserId), 
      updaterRole,
      updaterBranchId ? parseInt(updaterBranchId) : undefined,
      updateData
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Update สำเร็จ
    broadcastShiftUpdate('UPDATE', updatedShift);

    sendSuccess(res, updatedShift, 'อัปเดตกะเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตกะ');
  }
};

/**
 * 🗑️ ลบกะ (soft delete)
 * DELETE /api/shifts/:id
 * 
 * Body: { 
 *   deletedByUserId: number,   // (จำเป็น) ผู้ลบ
 *   deleterRole: string,       // (จำเป็น) Role ของผู้ลบ
 *   deleterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้ลบ
 *   deleteReason: string       // (จำเป็น) เหตุผลในการลบ
 * }
 */
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id as string);

    if (!shiftId || isNaN(shiftId)) {
      return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);
    }

    const { deletedByUserId, deleterRole, deleterBranchId, deleteReason } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!deletedByUserId) {
      return sendError(res, 'กรุณาระบุ deletedByUserId (ผู้ลบ)', 400);
    }

    if (!deleterRole || !['ADMIN', 'SUPERADMIN'].includes(deleterRole)) {
      return sendError(res, 'กรุณาระบุ deleterRole ที่ถูกต้อง (ADMIN หรือ SUPERADMIN)', 400);
    }

    if (!deleteReason || deleteReason.trim().length === 0) {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    // เรียก service
    await shiftService.deleteShift(
      shiftId, 
      parseInt(deletedByUserId), 
      deleterRole,
      deleterBranchId ? parseInt(deleterBranchId) : undefined,
      deleteReason
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Delete สำเร็จ
    broadcastShiftUpdate('DELETE', { shiftId, deleteReason });

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
