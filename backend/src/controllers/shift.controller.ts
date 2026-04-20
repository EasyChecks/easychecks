import type { Request, Response } from 'express';
import type { ShiftType } from '@prisma/client';
import * as shiftService from '../services/shift.service.js';
import { broadcastShiftUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';

/** normalize query/params ให้ parse ได้เสถียรเมื่อ framework ส่งค่ามาเป็น array */
function qs(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0] as string;
  return undefined;
}

function deriveHttpStatus(message: string): number {
  if (message.includes('ไปแล้ว') || message.includes('active shift') || message.includes('อยู่แล้ว')) return 409;
  if (message.includes('ไม่พบ')) return 404;
  if (message.includes('ไม่มีสิทธิ์')) return 403;
  if (message.includes('กรุณา') || message.includes('ต้อง')) return 400;
  return 500;
}

/** create shift endpoint: controller เก็บเฉพาะ auth/validation boundary */
export const createShift = async (req: Request, res: Response) => {
  try {
    // ใช้ identity จาก token เท่านั้นเพื่อตัดช่องปลอม role/branch จาก client
    const createdByUserId = req.user?.userId;
    const creatorRole = req.user?.role;
    const creatorBranchId = req.user?.branchId;

    if (createdByUserId === undefined || creatorRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    const {
      userId,
      userIds,
      replaceExisting,
      name,
      shiftType,
      startTime,
      endTime,
      gracePeriodMinutes,
      lateThresholdMinutes,
      specificDays,
      customDate,
      locationId,
    } = req.body as {
      userId?: number;
      userIds?: number[];
      replaceExisting?: boolean;
      name?: string;
      shiftType?: string;
      startTime?: string;
      endTime?: string;
      gracePeriodMinutes?: number;
      lateThresholdMinutes?: number;
      specificDays?: string[];
      customDate?: string;
      locationId?: number;
    };

    if (!name) return sendError(res, 'กรุณาระบุชื่อกะ (name)', 400);
    if (!shiftType) return sendError(res, 'กรุณาระบุ shiftType (REGULAR, SPECIFIC_DAY, CUSTOM)', 400);
    if (!startTime) return sendError(res, 'กรุณาระบุเวลาเริ่มงาน (startTime HH:MM)', 400);
    if (!endTime) return sendError(res, 'กรุณาระบุเวลาเลิกงาน (endTime HH:MM)', 400);

    const normalizedUserIds = Array.from(
      new Set(
        (Array.isArray(userIds) ? userIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
    const hasSingleUserId = userId !== undefined && Number.isInteger(Number(userId)) && Number(userId) > 0;

    if (!hasSingleUserId && normalizedUserIds.length === 0) {
      return sendError(res, 'กรุณาระบุ userId หรือ userIds อย่างน้อย 1 คน', 400);
    }

    const targetUserIds = normalizedUserIds.length > 0
      ? normalizedUserIds
      : [Number(userId)];

    if (targetUserIds.length > 1) {
      const result = await shiftService.createBulkShift({
        name,
        shiftType: shiftType as Parameters<typeof shiftService.createBulkShift>[0]['shiftType'],
        startTime,
        endTime,
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : undefined,
        lateThresholdMinutes: lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : undefined,
        specificDays: specificDays as Parameters<typeof shiftService.createBulkShift>[0]['specificDays'],
        customDate,
        locationId: locationId === null ? null : (locationId !== undefined ? Number(locationId) : undefined),
        userIds: targetUserIds,
        replaceExisting: replaceExisting === true,
        createdByUserId,
        creatorRole,
        creatorBranchId,
      });

      result.shifts.forEach((shift) => {
        broadcastShiftUpdate('CREATE', shift);
      });

      return sendSuccess(res, result, `สร้างกะเรียบร้อยแล้ว ${result.createdCount} รายการ`, 201);
    }

    const shift = await shiftService.createShift({
      name,
      shiftType: shiftType as Parameters<typeof shiftService.createShift>[0]['shiftType'],
      startTime,
      endTime,
      gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : undefined,
      lateThresholdMinutes: lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : undefined,
      specificDays: specificDays as Parameters<typeof shiftService.createShift>[0]['specificDays'],
      customDate,
      locationId: locationId === null ? null : (locationId !== undefined ? Number(locationId) : undefined),
      userId: targetUserIds[0] as number,
      replaceExisting: replaceExisting === true,
      createdByUserId,
      creatorRole,
      creatorBranchId,
    });

    // broadcast หลังเขียนสำเร็จเท่านั้นเพื่อไม่ให้ client รับสถานะหลอก
    broadcastShiftUpdate('CREATE', shift);

    sendSuccess(res, shift, 'สร้างกะเรียบร้อยแล้ว', 201);
  } catch (error: unknown) {
    if (error instanceof shiftService.BulkShiftCreateError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/** route เสริมสำหรับ bulk โดยตรง เพื่อรองรับ client ที่ส่งเฉพาะ userIds */
export const createBulkShift = async (req: Request, res: Response) => {
  try {
    const createdByUserId = req.user?.userId;
    const creatorRole = req.user?.role;
    const creatorBranchId = req.user?.branchId;

    if (createdByUserId === undefined || creatorRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    const {
      userIds,
      replaceExisting,
      name,
      shiftType,
      startTime,
      endTime,
      gracePeriodMinutes,
      lateThresholdMinutes,
      specificDays,
      customDate,
      locationId,
    } = req.body as {
      userIds?: number[];
      replaceExisting?: boolean;
      name?: string;
      shiftType?: string;
      startTime?: string;
      endTime?: string;
      gracePeriodMinutes?: number;
      lateThresholdMinutes?: number;
      specificDays?: string[];
      customDate?: string;
      locationId?: number | null;
    };

    if (!name) return sendError(res, 'กรุณาระบุชื่อกะ (name)', 400);
    if (!shiftType) return sendError(res, 'กรุณาระบุ shiftType (REGULAR, SPECIFIC_DAY, CUSTOM)', 400);
    if (!startTime) return sendError(res, 'กรุณาระบุเวลาเริ่มงาน (startTime HH:MM)', 400);
    if (!endTime) return sendError(res, 'กรุณาระบุเวลาเลิกงาน (endTime HH:MM)', 400);
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return sendError(res, 'กรุณาระบุ userIds อย่างน้อย 1 คน', 400);
    }

    const result = await shiftService.createBulkShift({
      name,
      shiftType: shiftType as Parameters<typeof shiftService.createBulkShift>[0]['shiftType'],
      startTime,
      endTime,
      gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : undefined,
      lateThresholdMinutes: lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : undefined,
      specificDays: specificDays as Parameters<typeof shiftService.createBulkShift>[0]['specificDays'],
      customDate,
      locationId: locationId === null ? null : (locationId !== undefined ? Number(locationId) : undefined),
      userIds: userIds.map((id) => Number(id)),
      replaceExisting: replaceExisting === true,
      createdByUserId,
      creatorRole,
      creatorBranchId,
    });

    result.shifts.forEach((shift) => {
      broadcastShiftUpdate('CREATE', shift);
    });

    sendSuccess(res, result, `สร้างกะแบบกลุ่มสำเร็จ ${result.createdCount} รายการ`, 201);
  } catch (error: unknown) {
    if (error instanceof shiftService.BulkShiftCreateError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างกะแบบกลุ่ม';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/** ใช้ role/branch จาก token เพื่อบังคับ data scope ที่ service */
export const getShifts = async (req: Request, res: Response) => {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;
    const requesterBranchId = req.user?.branchId;

    if (requesterId === undefined || requesterRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    const userId = qs(req.query['userId']);
    const shiftType = qs(req.query['shiftType']) as ShiftType | undefined;
    const isActiveRaw = qs(req.query['isActive']);

    type ShiftFilters = Parameters<typeof shiftService.getShifts>[3];
    const filters: ShiftFilters = {};
    if (userId !== undefined) filters.userId = parseInt(userId);
    if (shiftType !== undefined) filters.shiftType = shiftType;
    if (isActiveRaw !== undefined) filters.isActive = isActiveRaw === 'true';

    const shifts = await shiftService.getShifts(requesterId, requesterRole, requesterBranchId, filters);
    sendSuccess(res, shifts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงกะที่ใช้งานได้ในวันนี้ของ user
 * GET /api/shifts/today/:userId
 */
export const getActiveShiftsToday = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(qs(req.params['userId']) ?? '');
    if (isNaN(userId)) return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);

    const shifts = await shiftService.getActiveShiftsForToday(userId);
    sendSuccess(res, shifts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลกะวันนี้';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงกะเฉพาะ ID
 * GET /api/shifts/:id
 */
export const getShiftById = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(shiftId)) return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);

    const shift = await shiftService.getShiftById(shiftId);
    sendSuccess(res, shift);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 🔄 อัปเดตกะ (Admin/SuperAdmin only)
 * PUT /api/shifts/:id
 *
 * Body: { name?, startTime?, endTime?, gracePeriodMinutes?,
 *         lateThresholdMinutes?, specificDays?, customDate?,
 *         locationId?, isActive? }
 */
export const updateShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(shiftId)) return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);

    const updatedByUserId = req.user?.userId;
    const updaterRole = req.user?.role;
    const updaterBranchId = req.user?.branchId;

    if (updatedByUserId === undefined || updaterRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    const {
      name,
      startTime,
      endTime,
      gracePeriodMinutes,
      lateThresholdMinutes,
      specificDays,
      customDate,
      locationId,
      userId,
      isActive,
      replaceExisting,
    } = req.body as Parameters<typeof shiftService.updateShift>[4];

    const updatedShift = await shiftService.updateShift(
      shiftId,
      updatedByUserId,
      updaterRole,
      updaterBranchId,
      {
        name,
        startTime,
        endTime,
        gracePeriodMinutes,
        lateThresholdMinutes,
        specificDays,
        customDate,
        locationId: locationId === null ? null : locationId,
        userId,
        isActive,
        replaceExisting,
      },
    );

    broadcastShiftUpdate('UPDATE', updatedShift);
    sendSuccess(res, updatedShift, 'อัปเดตกะเรียบร้อยแล้ว');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 🗑️ ลบกะ (Admin/SuperAdmin only — Soft Delete)
 * DELETE /api/shifts/:id
 *
 * Body: { deleteReason: string }
 */
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(shiftId)) return sendError(res, 'กรุณาระบุ shiftId ที่ถูกต้อง', 400);

    const deletedByUserId = req.user?.userId;
    const deleterRole = req.user?.role;
    const deleterBranchId = req.user?.branchId;

    if (deletedByUserId === undefined || deleterRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    const { deleteReason } = req.body as { deleteReason?: string };
    if (!deleteReason || deleteReason.trim().length === 0) {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    await shiftService.deleteShift(shiftId, deletedByUserId, deleterRole, deleterBranchId, deleteReason);

    broadcastShiftUpdate('DELETE', { shiftId, deleteReason });
    sendSuccess(res, null, 'ลบกะเรียบร้อยแล้ว');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

export default {
  createShift,
  createBulkShift,
  getShifts,
  getActiveShiftsToday,
  getShiftById,
  updateShift,
  deleteShift,
};
