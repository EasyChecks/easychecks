import type { Request, Response } from 'express';
import type { ShiftType } from '@prisma/client';
import * as shiftService from '../services/shift.service.js';
import { broadcastShiftUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';

/** req.query の値は string | string[] になりうるので string に正規化する */
function qs(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0] as string;
  return undefined;
}

function deriveHttpStatus(message: string): number {
  if (message.includes('ไปแล้ว')) return 409;
  if (message.includes('ไม่พบ')) return 404;
  if (message.includes('ไม่มีสิทธิ์')) return 403;
  if (message.includes('กรุณา') || message.includes('ต้อง')) return 400;
  return 500;
}

/**
 * 📋 Shift Controller — API จัดการตารางงาน/กะ
 *
 * ทำไม Controller ถึงบางมาก?
 * - รับ request, ตรวจ params/body เบื้องต้น
 * - ดึง identity (userId, role, branchId) จาก req.user ที่ authenticate middleware ตั้งไว้
 *   → ไม่ต้องรับจาก body อีกต่อไป เพราะ client ปลอมได้
 * - business logic ทั้งหมดอยู่ใน shift.service.ts
 *
 * ============================================================
 * API ENDPOINT REFERENCE (การสร้างตารางงาน)
 * ============================================================
 *
 * POST /api/shifts
 *   → Admin/SuperAdmin สร้างกะให้พนักงาน
 *   → Body: { name, shiftType, startTime, endTime, userId,
 *             gracePeriodMinutes?, lateThresholdMinutes?,
 *             specificDays?, customDate?, locationId? }
 *   → gracePeriodMinutes  = เข้าก่อนได้กี่นาทีถึงนับว่าตรงเวลา (default 15)
 *   → lateThresholdMinutes = สายเกินนี้นาทีถือว่าขาดงาน (default 30)
 *
 * GET /api/shifts
 *   → SuperAdmin: เห็นทุกกะ | Admin: เห็นสาขาตัวเอง | User: เห็นกะตัวเอง
 *   → Query: userId?, shiftType?, isActive?
 *
 * GET /api/shifts/today/:userId
 *   → กะที่ใช้งานได้วันนี้ของพนักงาน (filter ตาม DayOfWeek / customDate)
 *
 * GET /api/shifts/:id
 *   → ดูรายละเอียดกะเดียว
 *
 * PUT /api/shifts/:id  (Admin/SuperAdmin only)
 *   → แก้ไขกะ: เวลา, grace period, late threshold, สถานที่, เปิด/ปิด
 *   → Body: { name?, startTime?, endTime?, gracePeriodMinutes?,
 *             lateThresholdMinutes?, specificDays?, customDate?,
 *             locationId?, isActive? }
 *
 * DELETE /api/shifts/:id  (Admin/SuperAdmin only — Soft Delete)
 *   → Body: { deleteReason: string }
 */

/**
 * ➕ สร้างกะใหม่ (Admin/SuperAdmin only)
 * POST /api/shifts
 */
export const createShift = async (req: Request, res: Response) => {
  try {
    // [1] ดึง identity ของผู้สร้างจาก token ที่ authenticate middleware ถอดรหัสไว้
    //     ทำไมไม่รับจาก body? ป้องกัน client ส่ง role='SUPERADMIN' ปลอมเพื่อสร้างกะสาขาอื่น
    const createdByUserId = req.user?.userId;   // id ของ Admin/SuperAdmin ที่กดสร้างกะ
    const creatorRole = req.user?.role;          // SUPERADMIN / ADMIN / MANAGER
    const creatorBranchId = req.user?.branchId; // service จะตรวจว่า userId อยู่สาขาเดียวกันไหม

    // [2] token ไม่มีข้อมูล → request ไม่ผ่าน middleware → reject ทันที
    if (createdByUserId === undefined || creatorRole === undefined) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);
    }

    // [3] Destructure body — field ที่ต้องมีจะ validate ข้างล่าง
    //     userId            → พนักงานที่จะรับกะนี้
    //     name              → ชื่อกะ เช่น "เช้า สาขา A"
    //     shiftType         → REGULAR (ทุกวัน) | SPECIFIC_DAY (ระบุวัน) | CUSTOM (วันที่เจาะจง)
    //     startTime/endTime → รูปแบบ "HH:MM" เช่น "08:00"
    //     gracePeriodMinutes    → เข้าก่อนได้กี่นาทีถือว่าตรงเวลา (default 15 ใน service)
    //     lateThresholdMinutes  → สายเกินนี้นาทีถือว่าขาด (default 30 ใน service)
    //     specificDays      → ["MONDAY","WEDNESDAY"] ใช้กับ SPECIFIC_DAY
    //     customDate        → "2025-12-31" ใช้กับ CUSTOM
    //     locationId?       → ผูก GPS radius กับกะนี้
    const {
      userId,
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

    // [4] Validate required fields — ส่ง 400 ทันทีพร้อมข้อความบอก field ที่ขาด
    if (userId === undefined) return sendError(res, 'กรุณาระบุ userId (พนักงานที่รับกะ)', 400);
    if (!name) return sendError(res, 'กรุณาระบุชื่อกะ (name)', 400);
    if (!shiftType) return sendError(res, 'กรุณาระบุ shiftType (REGULAR, SPECIFIC_DAY, CUSTOM)', 400);
    if (!startTime) return sendError(res, 'กรุณาระบุเวลาเริ่มงาน (startTime HH:MM)', 400);
    if (!endTime) return sendError(res, 'กรุณาระบุเวลาเลิกงาน (endTime HH:MM)', 400);

    // [5] สร้างกะผ่าน service — service จะตรวจสิทธิ์ (Admin ข้ามสาขาไม่ได้)
    //     แปลง Number() ตรงนี้เพราะ body JSON อาจส่งตัวเลขมาเป็น string
    const shift = await shiftService.createShift({
      name,
      shiftType: shiftType as Parameters<typeof shiftService.createShift>[0]['shiftType'],
      startTime,
      endTime,
      gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : undefined,
      lateThresholdMinutes: lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : undefined,
      specificDays: specificDays as Parameters<typeof shiftService.createShift>[0]['specificDays'],
      customDate,
      locationId: locationId !== undefined ? Number(locationId) : undefined,
      userId: Number(userId),
      createdByUserId,   // ผู้สร้าง (จาก token)
      creatorRole,       // บทบาท (จาก token) — service ใช้ตรวจสิทธิ์ครอสสาขา
      creatorBranchId,   // สาขาผู้สร้าง (จาก token)
    });

    // [6] Broadcast ให้ client ที่เปิด Dashboard อยู่รู้ว่ามีกะใหม่
    broadcastShiftUpdate('CREATE', shift);

    // [7] Response 201 Created พร้อม shift record ที่เพิ่ง INSERT
    sendSuccess(res, shift, 'สร้างกะเรียบร้อยแล้ว', 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างกะ';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงกะทั้งหมด (ตาม role และ branch)
 * GET /api/shifts
 *
 * ทำไม role และ branchId ดึงจาก req.user?
 * เพื่อให้ getShifts() กรองข้อมูลตามสิทธิ์จริงของ user ที่ login อยู่
 */
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
      isActive,
    } = req.body as Parameters<typeof shiftService.updateShift>[4];

    const updatedShift = await shiftService.updateShift(
      shiftId,
      updatedByUserId,
      updaterRole,
      updaterBranchId,
      { name, startTime, endTime, gracePeriodMinutes, lateThresholdMinutes, specificDays, customDate, locationId, isActive },
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
  getShifts,
  getActiveShiftsToday,
  getShiftById,
  updateShift,
  deleteShift,
};
